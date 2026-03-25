import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { user } from "@sanotalk/db";
import { eq } from "drizzle-orm";
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
});
