import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { user, userProperty } from "@sanotalk/db";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const userRouter = createTRPCRouter({
  profile: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.user.findFirst({
      where: eq(user.id, ctx.user.id),
      with: {
        linkedDoctor: true,
        linkedPharmacist: true,
      },
    });
  }),

  listByRole: protectedProcedure
    .input(z.object({ role: z.enum(["doctor", "pharmacist"]) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.user.findMany({
        where: eq(user.role, input.role),
        columns: { id: true, name: true, email: true, specialty: true, licenseNumber: true },
      });
    }),

  listAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.user.findMany({
      columns: { id: true, name: true, role: true },
    });
  }),

  update: protectedProcedure
    .input(
      z.object({
        linkedDoctorId: z.string().nullable().optional(),
        linkedPharmacistId: z.string().nullable().optional(),
        specialty: z.string().nullable().optional(),
        licenseNumber: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = (ctx.user as any).role as string;

      let values: Record<string, unknown> = {};

      if (role === "patient") {
        if (input.linkedDoctorId !== undefined) values.linkedDoctorId = input.linkedDoctorId;
        if (input.linkedPharmacistId !== undefined) values.linkedPharmacistId = input.linkedPharmacistId;
      } else if (role === "doctor" || role === "pharmacist") {
        if (input.specialty !== undefined) values.specialty = input.specialty;
        if (input.licenseNumber !== undefined) values.licenseNumber = input.licenseNumber;
      } else {
        throw new TRPCError({ code: "FORBIDDEN", message: "Profile editing not available for this role" });
      }

      if (Object.keys(values).length === 0) return;

      const [updated] = await ctx.db
        .update(user)
        .set(values)
        .where(eq(user.id, ctx.user.id))
        .returning();

      return updated;
    }),

  listProperties: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(userProperty)
      .where(eq(userProperty.userId, ctx.user.id))
      .orderBy(userProperty.createdAt);
  }),

  setPropertiesLanguage: protectedProcedure
    .input(z.object({ language: z.string().min(2).max(10) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({ propertiesLanguage: input.language })
        .where(eq(user.id, ctx.user.id));
      return { updated: true };
    }),

  setProperty: protectedProcedure
    .input(z.object({
      key: z.string().min(1).max(100),
      value: z.string().max(1000),
      language: z.string().min(2).max(10).default("en"),
    }))
    .mutation(async ({ ctx, input }) => {
      // Sync propertiesLanguage on the user record
      await ctx.db
        .update(user)
        .set({ propertiesLanguage: input.language })
        .where(eq(user.id, ctx.user.id));

      // Check if key already exists for this user
      const existing = await ctx.db
        .select({ id: userProperty.id })
        .from(userProperty)
        .where(and(eq(userProperty.userId, ctx.user.id), eq(userProperty.key, input.key)));

      if (existing.length > 0) {
        const [updated] = await ctx.db
          .update(userProperty)
          .set({ value: input.value })
          .where(and(eq(userProperty.userId, ctx.user.id), eq(userProperty.key, input.key)))
          .returning();
        return updated;
      } else {
        const [inserted] = await ctx.db
          .insert(userProperty)
          .values({ userId: ctx.user.id, key: input.key, value: input.value })
          .returning();
        return inserted;
      }
    }),

  deleteProperty: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(userProperty)
        .where(and(eq(userProperty.id, input.id), eq(userProperty.userId, ctx.user.id)));
      return { deleted: true };
    }),
});
