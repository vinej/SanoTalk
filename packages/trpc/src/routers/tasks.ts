import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { task } from "@sanotalk/db";
import { eq, or, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { verifyAdminFromDb } from "../lib/verify-admin";

export const tasksRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
    if (isAdmin) {
      // remark column excluded from SQL SELECT — never fetched from DB
      const tasks = await ctx.db.query.task.findMany({
        columns: { remark: false },
        with: { assignedUser: true },
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      });
      // remark: null added for type-shape compatibility; value never comes from DB
      return tasks.map((t) => ({ ...t, remark: null as null }));
    }
    return ctx.db.query.task.findMany({
      where: or(isNull(task.assignedUserId), eq(task.assignedUserId, ctx.user.id)),
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
      if (await verifyAdminFromDb(ctx.db, ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "Admins cannot create tasks" });
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
      const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
      if (isAdmin) throw new TRPCError({ code: "FORBIDDEN", message: "Admins cannot modify tasks" });
      const { id, ...fields } = input;
      const existing = await ctx.db.query.task.findFirst({ where: eq(task.id, id) });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      if (existing.assignedUserId !== null && existing.assignedUserId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the assigned user can edit this task" });
      }
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
      if (await verifyAdminFromDb(ctx.db, ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "Admins cannot delete tasks" });
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
