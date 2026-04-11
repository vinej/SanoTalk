import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { user, userProperty, userLink, userFriend, connectionRequest, aiAssistantProfile, session } from "@sanotalk/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { verifyAdminFromDb } from "../lib/verify-admin";
import { getRelatedUserIds } from "../lib/related-users";
import { encrypt, decrypt } from "../lib/crypto";
import { resend } from "../lib/resend";
import { escapeHtml } from "../lib/escape-html";
import { logAuditEvent } from "../lib/audit";

export const userRouter = createTRPCRouter({
  profile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.user.findFirst({
      where: eq(user.id, ctx.user.id),
      columns: {
        id: true, name: true, email: true, image: true, role: true, approved: true,
        specialty: true, licenseNumber: true, propertiesLanguage: true, createdAt: true,
      },
    });
  }),

  listByRole: protectedProcedure
    .input(z.object({ role: z.enum(["doctor", "pharmacist", "patient"]) }))
    .query(async ({ ctx, input }) => {
      const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
      if (isAdmin) {
        return ctx.db.query.user.findMany({
          where: eq(user.role, input.role),
          columns: { id: true, name: true, specialty: true, role: true },
          limit: 1000,
        });
      }
      const relatedIds = await getRelatedUserIds(ctx.db, ctx.user.id);
      if (relatedIds.size === 0) return [];
      return ctx.db.query.user.findMany({
        where: and(eq(user.role, input.role), inArray(user.id, [...relatedIds])),
        columns: { id: true, name: true, specialty: true, role: true },
        limit: 1000,
      });
    }),

  listAll: protectedProcedure.query(async ({ ctx }) => {
    const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
    if (isAdmin) {
      return ctx.db.query.user.findMany({
        columns: { id: true, name: true, role: true },
        limit: 1000,
      });
    }
    const relatedIds = await getRelatedUserIds(ctx.db, ctx.user.id);
    if (relatedIds.size === 0) return [];
    return ctx.db.query.user.findMany({
      where: inArray(user.id, [...relatedIds]),
      columns: { id: true, name: true, role: true },
      limit: 1000,
    });
  }),

  listAiAssistants: protectedProcedure.query(async ({ ctx }) => {
    const profiles = await ctx.db.query.aiAssistantProfile.findMany({
      where: eq(aiAssistantProfile.isActive, true),
      with: { user: { columns: { id: true, name: true, image: true, role: true } } },
      limit: 50,
    });
    return profiles.map((p) => ({
      id: p.user.id,
      name: p.user.name,
      image: p.user.image,
      role: p.user.role,
      type: p.type,
      gender: p.gender,
      personality: p.personality,
    }));
  }),

  update: protectedProcedure
    .input(
      z.object({
        specialty: z.string().max(200).nullable().optional(),
        licenseNumber: z.string().max(50).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = (ctx.user as any).role as string;

      if (role !== "doctor" && role !== "pharmacist") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Profile editing not available for this role" });
      }

      const values: Record<string, unknown> = {};
      if (input.specialty !== undefined) values.specialty = input.specialty;
      if (input.licenseNumber !== undefined) values.licenseNumber = input.licenseNumber;

      if (Object.keys(values).length === 0) return;

      const [updated] = await ctx.db
        .update(user)
        .set(values)
        .where(eq(user.id, ctx.user.id))
        .returning({
          id: user.id, name: user.name, role: user.role,
          specialty: user.specialty, licenseNumber: user.licenseNumber,
        });

      return updated;
    }),

  updateImage: protectedProcedure
    .input(z.object({ image: z.string().max(300).nullable() }))
    .mutation(async ({ ctx, input }) => {
      // Only allow null (remove) or valid MinIO avatar keys
      if (input.image !== null && !/^avatars\/[\w-]+\.(jpg|png|webp)$/.test(input.image)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid image value" });
      }
      const [updated] = await ctx.db
        .update(user)
        .set({ image: input.image })
        .where(eq(user.id, ctx.user.id))
        .returning({ id: user.id, image: user.image });
      return updated;
    }),

  // ── Professional links (patient ↔ doctor/pharmacist) ──────────────────────

  listLinkedUsers: protectedProcedure.query(async ({ ctx }) => {
    const role = (ctx.user as any).role as string;
    if (role === "patient") {
      const rows = await ctx.db.query.userLink.findMany({
        where: eq(userLink.patientId, ctx.user.id),
        with: { professional: { columns: { id: true, name: true, role: true, specialty: true } } },
        limit: 200,
      });
      return rows.map((r) => ({ ...r.professional, linkType: r.linkType }));
    }
    // doctor or pharmacist
    const rows = await ctx.db.query.userLink.findMany({
      where: eq(userLink.professionalId, ctx.user.id),
      with: { patient: { columns: { id: true, name: true, role: true } } },
      limit: 200,
    });
    return rows.map((r) => ({ ...r.patient, linkType: r.linkType }));
  }),

  addUserLink: protectedProcedure
    .input(z.object({
      targetUserId: z.string().min(1).max(100),
      linkType: z.enum(["doctor", "wellness"]).optional().default("doctor"),
    }))
    .mutation(async ({ ctx, input }) => {
      const senderRole = (ctx.user as any).role as string;
      if (senderRole === "ia_agent" || senderRole === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This role cannot create links" });
      }
      if (input.targetUserId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot link to yourself" });
      }
      const targetExists = await ctx.db.select({ id: user.id }).from(user).where(eq(user.id, input.targetUserId)).limit(1);
      if (targetExists.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Could not create link" });
      }
      await ctx.db
        .insert(connectionRequest)
        .values({ fromUserId: ctx.user.id, toUserId: input.targetUserId, type: "link", linkType: input.linkType })
        .onConflictDoNothing();
      return { ok: true };
    }),

  removeUserLink: protectedProcedure
    .input(z.object({
      targetUserId: z.string().min(1).max(100),
      linkType: z.enum(["doctor", "wellness"]).optional().default("doctor"),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = (ctx.user as any).role as string;
      if (role !== "patient" && role !== "doctor" && role !== "pharmacist") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This role cannot manage links" });
      }
      const [patientId, professionalId] = role === "patient"
        ? [ctx.user.id, input.targetUserId]
        : [input.targetUserId, ctx.user.id];
      const exists = await ctx.db.query.userLink.findFirst({
        where: and(eq(userLink.patientId, patientId), eq(userLink.professionalId, professionalId), eq(userLink.linkType, input.linkType)),
      });
      if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Link not found" });
      await ctx.db.delete(userLink).where(
        and(eq(userLink.patientId, patientId), eq(userLink.professionalId, professionalId), eq(userLink.linkType, input.linkType))
      );
      return { ok: true };
    }),

  // ── Friends (any role, directional) ───────────────────────────────────────

  listFriends: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.userFriend.findMany({
      where: eq(userFriend.userId, ctx.user.id),
      with: { friend: { columns: { id: true, name: true, role: true, specialty: true } } },
      limit: 200,
    });
    return rows.map((r) => r.friend);
  }),

  addFriend: protectedProcedure
    .input(z.object({ friendId: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const senderRole = (ctx.user as any).role as string;
      if (senderRole === "ia_agent" || senderRole === "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "This role cannot add friends" });
      }
      if (input.friendId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot add yourself as a friend" });
      }
      await ctx.db
        .insert(connectionRequest)
        .values({ fromUserId: ctx.user.id, toUserId: input.friendId, type: "friend" })
        .onConflictDoNothing();
      return { ok: true };
    }),

  removeFriend: protectedProcedure
    .input(z.object({ friendId: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const exists = await ctx.db.query.userFriend.findFirst({
        where: and(eq(userFriend.userId, ctx.user.id), eq(userFriend.friendId, input.friendId)),
      });
      if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Friendship not found" });
      await ctx.db.delete(userFriend).where(
        and(eq(userFriend.userId, ctx.user.id), eq(userFriend.friendId, input.friendId))
      );
      // Remove reverse direction too (mutual friendship)
      await ctx.db.delete(userFriend).where(
        and(eq(userFriend.userId, input.friendId), eq(userFriend.friendId, ctx.user.id))
      );
      return { ok: true };
    }),

  // ── Connection requests ───────────────────────────────────────────────────

  listPendingRequests: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.connectionRequest.findMany({
      where: and(
        eq(connectionRequest.toUserId, ctx.user.id),
        eq(connectionRequest.status, "pending")
      ),
      with: { fromUser: { columns: { id: true, name: true, role: true, specialty: true } } },
      orderBy: [desc(connectionRequest.createdAt)],
      limit: 200,
    });
    return rows;
  }),

  listSentPendingRequests: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.connectionRequest.findMany({
      where: and(
        eq(connectionRequest.fromUserId, ctx.user.id),
        eq(connectionRequest.status, "pending")
      ),
      with: { toUser: { columns: { id: true, name: true, role: true } } },
      limit: 200,
    });
  }),

  respondToRequest: protectedProcedure
    .input(z.object({
      requestId: z.string().uuid(),
      response: z.enum(["accepted", "refused"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.query.connectionRequest.findFirst({
        where: and(
          eq(connectionRequest.id, input.requestId),
          eq(connectionRequest.toUserId, ctx.user.id),
          eq(connectionRequest.status, "pending")
        ),
        with: { fromUser: { columns: { id: true, role: true } } },
      });
      if (!req) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db
        .update(connectionRequest)
        .set({ status: input.response, updatedAt: new Date() })
        .where(eq(connectionRequest.id, input.requestId));

      if (input.response === "accepted") {
        if (req.type === "link") {
          const fromRole = (req.fromUser as any).role as string;
          const toRole = (ctx.user as any).role as string;
          const roles = new Set([fromRole, toRole]);
          // A link must be between exactly one patient and one professional
          if (!roles.has("patient") || (!roles.has("doctor") && !roles.has("pharmacist"))) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Link requires one patient and one doctor or pharmacist" });
          }
          const [patientId, professionalId] = fromRole === "patient"
            ? [req.fromUserId, ctx.user.id]
            : [ctx.user.id, req.fromUserId];
          await ctx.db.insert(userLink).values({ patientId, professionalId, linkType: req.linkType ?? "doctor" }).onConflictDoNothing();
        } else {
          // type === "friend" — mutual
          await ctx.db.insert(userFriend)
            .values([
              { userId: req.fromUserId, friendId: ctx.user.id },
              { userId: ctx.user.id,    friendId: req.fromUserId },
            ])
            .onConflictDoNothing();
        }
      }
      return { ok: true };
    }),

  cancelRequest: protectedProcedure
    .input(z.object({
      targetUserId: z.string().min(1).max(100),
      type: z.enum(["link", "friend"]),
      linkType: z.enum(["doctor", "wellness"]).optional().default("doctor"),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(connectionRequest).where(
        and(
          eq(connectionRequest.fromUserId, ctx.user.id),
          eq(connectionRequest.toUserId, input.targetUserId),
          eq(connectionRequest.type, input.type),
          eq(connectionRequest.linkType, input.linkType),
          eq(connectionRequest.status, "pending")
        )
      );
      return { ok: true };
    }),

  listProperties: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(userProperty)
      .where(eq(userProperty.userId, ctx.user.id))
      .orderBy(userProperty.createdAt)
      .limit(200);
    return rows.map((r) => ({ ...r, value: decrypt(r.value) }));
  }),

  setPropertiesLanguage: protectedProcedure
    .input(z.object({ language: z.enum(["en", "fr", "es", "zh", "ar", "hi"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({ propertiesLanguage: input.language })
        .where(eq(user.id, ctx.user.id));
      return { updated: true };
    }),

  setProperty: protectedProcedure
    .input(z.object({
      key: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/, "Invalid property key"),
      value: z.string().max(1000),
      language: z.enum(["en", "fr", "es", "zh", "ar", "hi"]).default("en"),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({ propertiesLanguage: input.language })
        .where(eq(user.id, ctx.user.id));

      const valueToStore = encrypt(input.value);

      const [result] = await ctx.db
        .insert(userProperty)
        .values({ userId: ctx.user.id, key: input.key, value: valueToStore })
        .onConflictDoUpdate({
          target: [userProperty.userId, userProperty.key],
          set: { value: valueToStore, updatedAt: new Date() },
        })
        .returning({ id: userProperty.id, key: userProperty.key });
      // Return the original plaintext value — never expose the encrypted ciphertext
      return { ...result, value: input.value };
    }),

  deleteProperty: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(userProperty)
        .where(and(eq(userProperty.id, input.id), eq(userProperty.userId, ctx.user.id)));
      return { deleted: true };
    }),

  setUserRole: protectedProcedure
    .input(z.object({
      targetUserId: z.string().min(1).max(100),
      role: z.enum(["patient", "doctor", "pharmacist"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
      if (!isAdmin) throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can change roles" });
      if (input.targetUserId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change your own role" });
      const target = await ctx.db.query.user.findFirst({ where: eq(user.id, input.targetUserId), columns: { id: true, role: true } });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      await ctx.db.update(user).set({ role: input.role }).where(eq(user.id, input.targetUserId));
      // Invalidate all sessions for the target user so stale role claims are not used
      await ctx.db.delete(session).where(eq(session.userId, input.targetUserId));

      void logAuditEvent(ctx.db, {
        userId: ctx.user.id,
        action: "set_user_role",
        targetUserId: input.targetUserId,
        resourceType: "user",
        resourceId: input.targetUserId,
        metadata: { previousRole: target.role, newRole: input.role },
      });

      return { ok: true, previousRole: target.role, newRole: input.role };
    }),

  /** Promote a user to admin role (admin only, audited) */
  promoteToAdmin: protectedProcedure
    .input(z.object({ targetUserId: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
      if (!isAdmin) throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can promote to admin" });
      if (input.targetUserId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot promote yourself" });
      const target = await ctx.db.query.user.findFirst({ where: eq(user.id, input.targetUserId), columns: { id: true, role: true } });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      if (target.role === "admin") throw new TRPCError({ code: "BAD_REQUEST", message: "User is already admin" });
      await ctx.db.update(user).set({ role: "admin" }).where(eq(user.id, input.targetUserId));
      await ctx.db.delete(session).where(eq(session.userId, input.targetUserId));

      void logAuditEvent(ctx.db, {
        userId: ctx.user.id,
        action: "promote_to_admin",
        targetUserId: input.targetUserId,
        resourceType: "user",
        resourceId: input.targetUserId,
        metadata: { previousRole: target.role },
      });

      return { ok: true, previousRole: target.role };
    }),

  listPendingApprovals: protectedProcedure.query(async ({ ctx }) => {
    const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
    if (!isAdmin) throw new TRPCError({ code: "FORBIDDEN" });
    return ctx.db.query.user.findMany({
      where: eq(user.approved, false),
      columns: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: [desc(user.createdAt)],
      limit: 500,
    });
  }),

  approveUser: protectedProcedure
    .input(z.object({ targetUserId: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
      if (!isAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      const target = await ctx.db.query.user.findFirst({
        where: eq(user.id, input.targetUserId),
        columns: { id: true, email: true, name: true, approved: true },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.approved) throw new TRPCError({ code: "BAD_REQUEST", message: "Already approved" });
      const [updated] = await ctx.db.update(user).set({ approved: true }).where(and(eq(user.id, input.targetUserId), eq(user.approved, false))).returning({ id: user.id });
      if (!updated) throw new TRPCError({ code: "CONFLICT", message: "User was modified concurrently" });
      const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
      const appUrl = process.env.APP_URL ?? "http://localhost:5173";
      await resend.emails.send({
        from,
        to: target.email,
        subject: "Your SanoTalk account has been activated",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#0f172a">Welcome to SanoTalk!</h2>
            <p>Hello ${escapeHtml(target.name)},</p>
            <p>Your registration has been approved by an administrator. You can now sign in and start using SanoTalk.</p>
            <p style="text-align:center;margin:24px 0">
              <a href="${escapeHtml(appUrl)}/login" style="background:#2563eb;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600">Sign in to SanoTalk</a>
            </p>
            <p style="color:#999;font-size:11px">If you did not register for SanoTalk, please ignore this email.</p>
          </div>
        `,
      });

      void logAuditEvent(ctx.db, {
        userId: ctx.user.id,
        action: "approve_user",
        targetUserId: input.targetUserId,
        resourceType: "user",
        resourceId: input.targetUserId,
      });

      return { ok: true };
    }),

  refuseUser: protectedProcedure
    .input(z.object({ targetUserId: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
      if (!isAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      const target = await ctx.db.query.user.findFirst({
        where: eq(user.id, input.targetUserId),
        columns: { id: true, email: true, name: true, approved: true },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.approved) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot refuse an approved user" });
      // Atomic delete with approved=false guard prevents race where another admin
      // approves the user between our check and delete.
      const [deleted] = await ctx.db.delete(user).where(and(eq(user.id, input.targetUserId), eq(user.approved, false))).returning({ id: user.id });
      if (!deleted) throw new TRPCError({ code: "CONFLICT", message: "User was modified concurrently" });

      void logAuditEvent(ctx.db, {
        userId: ctx.user.id,
        action: "refuse_user",
        targetUserId: input.targetUserId,
        resourceType: "user",
        resourceId: input.targetUserId,
      });

      const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
      await resend.emails.send({
        from,
        to: target.email,
        subject: "Your SanoTalk registration",
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#0f172a">SanoTalk Registration</h2>
            <p>Hello ${escapeHtml(target.name)},</p>
            <p>We regret to inform you that your SanoTalk registration has been declined.</p>
            <p>If you believe this is an error, please contact us.</p>
            <p style="color:#999;font-size:11px">SanoTalk — AI-powered medical consultations.</p>
          </div>
        `,
      });
      return { ok: true };
    }),
});
