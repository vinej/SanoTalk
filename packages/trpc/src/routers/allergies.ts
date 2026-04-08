import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { allergy, chronicCondition } from "@sanotalk/db";
import { eq, and, desc } from "drizzle-orm";

const allergyTypeEnum = z.enum(["drug", "food", "environmental", "other"]);
const severityEnum = z.enum(["mild", "moderate", "severe", "life_threatening"]);
const conditionStatusEnum = z.enum(["active", "managed", "resolved"]);
const conditionSeverityEnum = z.enum(["mild", "moderate", "severe"]);

export const allergiesRouter = createTRPCRouter({
  // ── Allergies ───────────────────────────────────────────────────────────

  listAllergies: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(allergy)
      .where(eq(allergy.userId, ctx.user.id))
      .orderBy(desc(allergy.createdAt))
      .limit(200);
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
          name: input.name,
          severity: input.severity,
          reaction: input.reaction ?? null,
          diagnosedDate: input.diagnosedDate ?? null,
          notes: input.notes ?? null,
        })
        .onConflictDoUpdate({
          target: [allergy.userId, allergy.name],
          set: {
            type: input.type,
            severity: input.severity,
            reaction: input.reaction ?? null,
            diagnosedDate: input.diagnosedDate ?? null,
            notes: input.notes ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
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
          name: input.name,
          severity: input.severity,
          reaction: input.reaction ?? null,
          diagnosedDate: input.diagnosedDate ?? null,
          notes: input.notes ?? null,
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
    return ctx.db
      .select()
      .from(chronicCondition)
      .where(eq(chronicCondition.userId, ctx.user.id))
      .orderBy(desc(chronicCondition.createdAt))
      .limit(200);
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
          name: input.name,
          status: input.status,
          severity: input.severity,
          diagnosedDate: input.diagnosedDate ?? null,
          medications: input.medications ?? null,
          notes: input.notes ?? null,
        })
        .onConflictDoUpdate({
          target: [chronicCondition.userId, chronicCondition.name],
          set: {
            status: input.status,
            severity: input.severity,
            diagnosedDate: input.diagnosedDate ?? null,
            medications: input.medications ?? null,
            notes: input.notes ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();
      return row;
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
          name: input.name,
          status: input.status,
          severity: input.severity,
          diagnosedDate: input.diagnosedDate ?? null,
          medications: input.medications ?? null,
          notes: input.notes ?? null,
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
