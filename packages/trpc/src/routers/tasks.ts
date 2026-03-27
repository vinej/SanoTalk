import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { task } from "@sanotalk/db";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

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
        taskType: z.enum(["standard", "summary_review"]).optional(),
        remark: z.string().optional(),
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
          taskType: input.taskType ?? "standard",
          remark: input.remark,
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
        remark: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;
      const existing = await ctx.db.query.task.findFirst({ where: eq(task.id, id) });
      if (existing?.taskType === "summary_review") {
        if (fields.assignedUserId !== undefined) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot reassign a summary review task" });
        }
        if (fields.status === "not_assigned") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot unassign a summary review task" });
        }
        const { remark, status } = fields;
        const [updated] = await ctx.db
          .update(task)
          .set({ remark, status, updatedAt: new Date() })
          .where(eq(task.id, id))
          .returning();
        return updated;
      }
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
      const existing = await ctx.db.query.task.findFirst({ where: eq(task.id, input.id) });
      if (existing?.taskType === "summary_review") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete a summary review task" });
      }
      await ctx.db.delete(task).where(eq(task.id, input.id));
    }),

  listUsers: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.user.findMany({
      columns: { id: true, name: true, email: true, role: true },
      orderBy: (u, { asc }) => [asc(u.name)],
    });
  }),
});
