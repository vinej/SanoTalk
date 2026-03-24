import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { task } from "@sanotalk/db";
import { eq } from "drizzle-orm";

export const tasksRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.task.findMany({
      with: { assignedUser: true },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        assignedUserId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const status = input.assignedUserId ? "assigned" : "not_assigned";
      const [created] = await ctx.db
        .insert(task)
        .values({
          title: input.title,
          description: input.description,
          status,
          assignedUserId: input.assignedUserId,
        })
        .returning();
      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        status: z.enum(["not_assigned", "assigned", "completed"]).optional(),
        assignedUserId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const [updated] = await ctx.db
        .update(task)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(task.id, id))
        .returning();
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(task).where(eq(task.id, input.id));
    }),
});
