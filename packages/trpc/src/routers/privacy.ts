import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trcp";
import {
  consentRecord,
  user,
  userProperty,
  vitalSign,
  medication,
  symptomLog,
  allergy,
  chronicCondition,
  chatMessage,
  savedConversation,
  talkSession,
  transcript,
  task,
  erFavorite,
  breachRecord,
  auditLog,
} from "@sanotalk/db";
import { eq, and, desc, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { logAuditEvent } from "../lib/audit";
import { verifyAdminFromDb } from "../lib/verify-admin";
import { decrypt, ENCRYPTED_KEYS } from "../lib/crypto";

const CURRENT_POLICY_VERSION = "2026-04-10";

const consentTypeSchema = z.enum(["cookies", "analytics", "privacy_policy", "ai_data_sharing"]);

export const privacyRouter = createTRPCRouter({
  /** Record a consent decision (works for both anonymous and authenticated users) */
  recordConsent: publicProcedure
    .input(z.object({
      consentType: consentTypeSchema,
      consented: z.boolean(),
      anonymousId: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(consentRecord).values({
        userId: ctx.user?.id ?? null,
        anonymousId: input.anonymousId ?? null,
        consentType: input.consentType,
        consented: input.consented,
        policyVersion: CURRENT_POLICY_VERSION,
        ipAddress: (ctx as any).ipAddress ?? null,
        userAgent: (ctx as any).userAgent ?? null,
      }).returning({ id: consentRecord.id });

      return { id: row!.id };
    }),

  /** Get the latest consent status for the current user, grouped by type */
  getMyConsent: protectedProcedure
    .query(async ({ ctx }) => {
      const records = await ctx.db
        .select({
          consentType: consentRecord.consentType,
          consented: consentRecord.consented,
          policyVersion: consentRecord.policyVersion,
          createdAt: consentRecord.createdAt,
          withdrawnAt: consentRecord.withdrawnAt,
        })
        .from(consentRecord)
        .where(eq(consentRecord.userId, ctx.user.id))
        .orderBy(desc(consentRecord.createdAt));

      const latest: Record<string, { consented: boolean; policyVersion: string; createdAt: Date; withdrawnAt: Date | null }> = {};
      for (const r of records) {
        if (!latest[r.consentType]) {
          latest[r.consentType] = {
            consented: r.consented,
            policyVersion: r.policyVersion,
            createdAt: r.createdAt,
            withdrawnAt: r.withdrawnAt,
          };
        }
      }
      return latest;
    }),

  /** Withdraw a specific consent */
  withdrawConsent: protectedProcedure
    .input(z.object({
      consentType: consentTypeSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Mark the latest consent record as withdrawn
      const latest = await ctx.db
        .select()
        .from(consentRecord)
        .where(and(
          eq(consentRecord.userId, ctx.user.id),
          eq(consentRecord.consentType, input.consentType),
        ))
        .orderBy(desc(consentRecord.createdAt))
        .limit(1);

      if (latest[0] && !latest[0].withdrawnAt) {
        await ctx.db
          .update(consentRecord)
          .set({ withdrawnAt: new Date() })
          .where(eq(consentRecord.id, latest[0].id));
      }

      // Insert new record marking consent as withdrawn
      await ctx.db.insert(consentRecord).values({
        userId: ctx.user.id,
        consentType: input.consentType,
        consented: false,
        policyVersion: CURRENT_POLICY_VERSION,
      });

      void logAuditEvent(ctx.db, {
        userId: ctx.user.id,
        action: "withdraw_consent",
        resourceType: "consent",
        resourceId: input.consentType,
      });

      return { withdrawn: true };
    }),

  /** Get AI data sharing consent status */
  getAiDataSharingConsent: protectedProcedure
    .query(async ({ ctx }) => {
      const [result] = await ctx.db
        .select({ aiDataSharingConsent: (user as any).aiDataSharingConsent })
        .from(user)
        .where(eq(user.id, ctx.user.id));
      return { consented: (result as any)?.aiDataSharingConsent === true };
    }),

  /** Toggle AI data sharing consent */
  setAiDataSharingConsent: protectedProcedure
    .input(z.object({ consented: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({ aiDataSharingConsent: input.consented } as any)
        .where(eq(user.id, ctx.user.id));

      // Record in consent history with correct type
      await ctx.db.insert(consentRecord).values({
        userId: ctx.user.id,
        consentType: "ai_data_sharing",
        consented: input.consented,
        policyVersion: CURRENT_POLICY_VERSION,
      });

      void logAuditEvent(ctx.db, {
        userId: ctx.user.id,
        action: input.consented ? "enable_ai_data_sharing" : "disable_ai_data_sharing",
        resourceType: "user",
        resourceId: ctx.user.id,
      });

      return { consented: input.consented };
    }),

  /** Full consent history for current user */
  consentHistory: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db
        .select({
          id: consentRecord.id,
          consentType: consentRecord.consentType,
          consented: consentRecord.consented,
          policyVersion: consentRecord.policyVersion,
          createdAt: consentRecord.createdAt,
          withdrawnAt: consentRecord.withdrawnAt,
        })
        .from(consentRecord)
        .where(eq(consentRecord.userId, ctx.user.id))
        .orderBy(desc(consentRecord.createdAt))
        .limit(100);
    }),

  /** Export all user data as JSON (data portability — Law 25) */
  exportMyData: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;

      const [
        profile,
        properties,
        vitals,
        meds,
        symptoms,
        allergies,
        conditions,
        chats,
        saved,
        sessions,
        transcripts,
        tasks,
        favorites,
        consents,
      ] = await Promise.all([
        ctx.db.select({
          id: user.id, name: user.name, email: user.email, role: user.role,
          createdAt: user.createdAt,
        }).from(user).where(eq(user.id, userId)),
        ctx.db.select().from(userProperty).where(eq(userProperty.userId, userId)),
        ctx.db.select().from(vitalSign).where(eq(vitalSign.userId, userId)),
        ctx.db.select().from(medication).where(eq(medication.userId, userId)),
        ctx.db.select().from(symptomLog).where(eq(symptomLog.userId, userId)),
        ctx.db.select().from(allergy).where(eq(allergy.userId, userId)),
        ctx.db.select().from(chronicCondition).where(eq(chronicCondition.userId, userId)),
        ctx.db.select().from(chatMessage).where(eq(chatMessage.userId, userId)),
        ctx.db.select().from(savedConversation).where(eq(savedConversation.userId, userId)),
        ctx.db.select().from(talkSession).where(eq(talkSession.hostId, userId)),
        ctx.db.select().from(transcript).where(eq(transcript.speakerId, userId)),
        ctx.db.select().from(task).where(eq(task.assignedUserId, userId)),
        ctx.db.select().from(erFavorite).where(eq(erFavorite.userId, userId)),
        ctx.db.select().from(consentRecord).where(eq(consentRecord.userId, userId)),
      ]);

      // Decrypt encrypted properties so the user receives readable data (Law 25 portability)
      const decryptedProperties = properties.map((r) =>
        ENCRYPTED_KEYS.has(r.key) ? { ...r, value: decrypt(r.value) } : r
      );

      void logAuditEvent(ctx.db, {
        userId, action: "export_data", resourceType: "user", resourceId: userId,
      });

      return {
        exportedAt: new Date().toISOString(),
        profile: profile[0] ?? null,
        properties: decryptedProperties,
        vitalSigns: vitals,
        medications: meds,
        symptomLogs: symptoms,
        allergies,
        chronicConditions: conditions,
        chatMessages: chats,
        savedConversations: saved,
        talkSessions: sessions,
        transcripts,
        tasks,
        erFavorites: favorites,
        consentRecords: consents,
      };
    }),

  /** Request account deletion (14-day grace period) */
  requestDeletion: protectedProcedure
    .mutation(async ({ ctx }) => {
      const now = new Date();
      const scheduledFor = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      await ctx.db
        .update(user)
        .set({
          deletionRequestedAt: now,
          deletionScheduledFor: scheduledFor,
        } as any)
        .where(eq(user.id, ctx.user.id));

      void logAuditEvent(ctx.db, {
        userId: ctx.user.id, action: "request_deletion", resourceType: "user", resourceId: ctx.user.id,
      });

      return { scheduledFor: scheduledFor.toISOString() };
    }),

  /** Cancel a pending deletion request */
  cancelDeletion: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db
        .update(user)
        .set({
          deletionRequestedAt: null,
          deletionScheduledFor: null,
        } as any)
        .where(eq(user.id, ctx.user.id));

      void logAuditEvent(ctx.db, {
        userId: ctx.user.id, action: "cancel_deletion", resourceType: "user", resourceId: ctx.user.id,
      });

      return { cancelled: true };
    }),

  /** Get deletion status */
  getDeletionStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const [result] = await ctx.db
        .select({
          deletionRequestedAt: (user as any).deletionRequestedAt,
          deletionScheduledFor: (user as any).deletionScheduledFor,
        })
        .from(user)
        .where(eq(user.id, ctx.user.id));

      return {
        deletionRequestedAt: result?.deletionRequestedAt ?? null,
        deletionScheduledFor: result?.deletionScheduledFor ?? null,
      };
    }),

  // ── Breach Register (admin-only) ──────────────────────────────────────────

  /** List all breach records (admin only) */
  listBreaches: protectedProcedure
    .query(async ({ ctx }) => {
      const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
      if (!isAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.db
        .select()
        .from(breachRecord)
        .orderBy(desc(breachRecord.discoveredAt))
        .limit(200);
    }),

  /** Create a breach record (admin only) */
  createBreach: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(5000),
      severity: z.enum(["low", "medium", "high", "critical"]),
      dataTypesAffected: z.string().max(500).optional(),
      usersAffected: z.number().int().min(0).default(0),
      discoveredAt: z.string().datetime(),
      remediationSteps: z.string().max(5000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
      if (!isAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      const [row] = await ctx.db.insert(breachRecord).values({
        title: input.title,
        description: input.description,
        severity: input.severity,
        dataTypesAffected: input.dataTypesAffected ?? null,
        usersAffected: input.usersAffected,
        discoveredAt: new Date(input.discoveredAt),
        remediationSteps: input.remediationSteps ?? null,
        createdBy: ctx.user.id,
      }).returning({ id: breachRecord.id });
      return { id: row!.id };
    }),

  /** Update a breach record (admin only) */
  updateBreach: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(["open", "investigating", "resolved"]).optional(),
      remediationSteps: z.string().max(5000).optional(),
      reportedToCaiAt: z.string().datetime().optional(),
      usersNotifiedAt: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
      if (!isAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (input.status) updates.status = input.status;
      if (input.remediationSteps !== undefined) updates.remediationSteps = input.remediationSteps;
      if (input.reportedToCaiAt) updates.reportedToCaiAt = new Date(input.reportedToCaiAt);
      if (input.usersNotifiedAt) updates.usersNotifiedAt = new Date(input.usersNotifiedAt);

      await ctx.db
        .update(breachRecord)
        .set(updates)
        .where(eq(breachRecord.id, input.id));
      return { updated: true };
    }),

  // ── Audit Log ─────────────────────────────────────────────────────────────

  /** List recent audit log entries (admin only) */
  listAuditLogs: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
      if (!isAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.db
        .select()
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(input?.limit ?? 100);
    }),
});
