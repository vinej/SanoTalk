import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { allergy, chronicCondition } from "@sanotalk/db";
import { eq, and, desc } from "drizzle-orm";
import { encryptContent, decryptContent, encryptArray, decryptArray, hashForIndex } from "../lib/crypto";

function decryptAllergyFields<T extends { name: string; reaction: string | null; notes: string | null }>(a: T): T {
  return { ...a, name: decryptContent(a.name) ?? a.name, reaction: decryptContent(a.reaction), notes: decryptContent(a.notes) };
}

function decryptConditionFields<T extends { name: string; medications: string[] | null; notes: string | null }>(c: T): T {
  return { ...c, name: decryptContent(c.name) ?? c.name, medications: decryptArray(c.medications), notes: decryptContent(c.notes) };
}

const allergyTypeEnum = z.enum(["drug", "food", "environmental", "other"]);
const severityEnum = z.enum(["mild", "moderate", "severe", "life_threatening"]);
const conditionStatusEnum = z.enum(["active", "managed", "resolved"]);
const conditionSeverityEnum = z.enum(["mild", "moderate", "severe"]);

export const allergiesRouter = createTRPCRouter({
  // ── Allergies ───────────────────────────────────────────────────────────

  listAllergies: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(allergy)
      .where(eq(allergy.userId, ctx.user.id))
      .orderBy(desc(allergy.createdAt))
      .limit(200);
    return rows.map(decryptAllergyFields);
  }),

  addAllergy: protectedProcedure
    .input(z.object({
      type: allergyTypeEnum,
      name: z.string().min(1).max(200),
      severity: severityEnum,
      reaction: z.string().max(500).optional(),
      diagnosedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(allergy)
        .values({
          userId: ctx.user.id,
          type: input.type,
          name: encryptContent(input.name)!,
          nameHash: hashForIndex(input.name),
          severity: input.severity,
          reaction: encryptContent(input.reaction ?? null),
          diagnosedDate: input.diagnosedDate ?? null,
          notes: encryptContent(input.notes ?? null),
        })
        .onConflictDoUpdate({
          target: [allergy.userId, allergy.nameHash],
          set: {
            type: input.type,
            name: encryptContent(input.name)!,
            severity: input.severity,
            reaction: encryptContent(input.reaction ?? null),
            diagnosedDate: input.diagnosedDate ?? null,
            notes: encryptContent(input.notes ?? null),
            updatedAt: new Date(),
          },
        })
        .returning({ id: allergy.id, type: allergy.type, name: allergy.name, severity: allergy.severity, reaction: allergy.reaction, diagnosedDate: allergy.diagnosedDate, notes: allergy.notes, createdAt: allergy.createdAt, updatedAt: allergy.updatedAt });
      return row ? decryptAllergyFields(row) : row;
    }),

  updateAllergy: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      type: allergyTypeEnum,
      name: z.string().min(1).max(200),
      severity: severityEnum,
      reaction: z.string().max(500).optional(),
      diagnosedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(allergy)
        .set({
          type: input.type,
          name: encryptContent(input.name)!,
          nameHash: hashForIndex(input.name),
          severity: input.severity,
          reaction: encryptContent(input.reaction ?? null),
          diagnosedDate: input.diagnosedDate ?? null,
          notes: encryptContent(input.notes ?? null),
          updatedAt: new Date(),
        })
        .where(and(eq(allergy.id, input.id), eq(allergy.userId, ctx.user.id)));
    }),

  deleteAllergy: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(allergy)
        .where(and(eq(allergy.id, input.id), eq(allergy.userId, ctx.user.id)));
    }),

  // ── Chronic Conditions ──────────────────────────────────────────────────

  listConditions: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(chronicCondition)
      .where(eq(chronicCondition.userId, ctx.user.id))
      .orderBy(desc(chronicCondition.createdAt))
      .limit(200);
    return rows.map(decryptConditionFields);
  }),

  addCondition: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      status: conditionStatusEnum,
      severity: conditionSeverityEnum,
      diagnosedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      medications: z.array(z.string().max(200)).max(20).optional(),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(chronicCondition)
        .values({
          userId: ctx.user.id,
          name: encryptContent(input.name)!,
          nameHash: hashForIndex(input.name),
          status: input.status,
          severity: input.severity,
          diagnosedDate: input.diagnosedDate ?? null,
          medications: encryptArray(input.medications ?? null),
          notes: encryptContent(input.notes ?? null),
        })
        .onConflictDoUpdate({
          target: [chronicCondition.userId, chronicCondition.nameHash],
          set: {
            name: encryptContent(input.name)!,
            status: input.status,
            severity: input.severity,
            diagnosedDate: input.diagnosedDate ?? null,
            medications: encryptArray(input.medications ?? null),
            notes: encryptContent(input.notes ?? null),
            updatedAt: new Date(),
          },
        })
        .returning({ id: chronicCondition.id, name: chronicCondition.name, status: chronicCondition.status, severity: chronicCondition.severity, diagnosedDate: chronicCondition.diagnosedDate, medications: chronicCondition.medications, notes: chronicCondition.notes, createdAt: chronicCondition.createdAt, updatedAt: chronicCondition.updatedAt });
      return row ? decryptConditionFields(row) : row;
    }),

  updateCondition: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200),
      status: conditionStatusEnum,
      severity: conditionSeverityEnum,
      diagnosedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      medications: z.array(z.string().max(200)).max(20).optional(),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(chronicCondition)
        .set({
          name: encryptContent(input.name)!,
          nameHash: hashForIndex(input.name),
          status: input.status,
          severity: input.severity,
          diagnosedDate: input.diagnosedDate ?? null,
          medications: encryptArray(input.medications ?? null),
          notes: encryptContent(input.notes ?? null),
          updatedAt: new Date(),
        })
        .where(and(eq(chronicCondition.id, input.id), eq(chronicCondition.userId, ctx.user.id)));
    }),

  deleteCondition: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(chronicCondition)
        .where(and(eq(chronicCondition.id, input.id), eq(chronicCondition.userId, ctx.user.id)));
    }),
});
