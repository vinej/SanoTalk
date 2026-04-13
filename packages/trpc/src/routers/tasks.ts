import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { task, user } from "@sanotalk/db";
import { eq, and, or, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { verifyAdminFromDb } from "../lib/verify-admin";
import { getRelatedUserIds } from "../lib/related-users";

export const tasksRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
    if (isAdmin) {
      // remark column excluded from SQL SELECT — never fetched from DB
      const tasks = await ctx.db.query.task.findMany({
        columns: { remark: false },
        with: { assignedUser: { columns: { id: true, name: true, role: true } } },
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit: 500,
      });
      // remark: null added for type-shape compatibility; value never comes from DB
      // description redacted for summary_review tasks to avoid leaking session URLs
      return tasks.map((t) => ({
        ...t,
        remark: null as null,
        description: t.taskType === "summary_review" ? null : t.description,
      }));
    }
    return ctx.db.query.task.findMany({
      where: or(
        eq(task.assignedUserId, ctx.user.id),
        eq(task.createdByUserId, ctx.user.id)
      ),
      with: { assignedUser: { columns: { id: true, name: true, role: true } } },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: 500,
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().max(5000).optional(),
        assignedUserId: z.string().optional(),
        taskType: z.enum(["standard", "summary_review"]).optional(),
        remark: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (await verifyAdminFromDb(ctx.db, ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "Admins cannot create tasks" });
      if (input.assignedUserId && input.assignedUserId !== ctx.user.id) {
        const relatedIds = await getRelatedUserIds(ctx.db, ctx.user.id, { acceptedOnly: true });
        if (!relatedIds.has(input.assignedUserId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Can only assign tasks to users linked in your profile" });
        }
      }
      const status = input.assignedUserId ? "assigned" : "not_assigned";
      const [created] = await ctx.db
        .insert(task)
        .values({
          title: input.title,
          description: input.description,
          status,
          assignedUserId: input.assignedUserId,
          createdByUserId: ctx.user.id,
          taskType: input.taskType ?? "standard",
          remark: input.remark,
        })
        .returning({ id: task.id, title: task.title, status: task.status, taskType: task.taskType, assignedUserId: task.assignedUserId, createdAt: task.createdAt });
      return created;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().max(5000).nullable().optional(),
        status: z.enum(["not_assigned", "assigned", "completed"]).optional(),
        assignedUserId: z.string().nullable().optional(),
        remark: z.string().max(2000).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
      if (isAdmin) throw new TRPCError({ code: "FORBIDDEN", message: "Admins cannot modify tasks" });
      if (input.assignedUserId && input.assignedUserId !== ctx.user.id) {
        const relatedIds = await getRelatedUserIds(ctx.db, ctx.user.id, { acceptedOnly: true });
        if (!relatedIds.has(input.assignedUserId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Can only assign tasks to users linked in your profile" });
        }
      }
      return ctx.db.transaction(async (tx) => {
        const { id, ...fields } = input;
        const accessFilter = or(
          eq(task.assignedUserId, ctx.user.id),
          eq(task.createdByUserId, ctx.user.id)
        );
        const existing = await tx.query.task.findFirst({ where: and(eq(task.id, id), accessFilter) });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
        if (existing.taskType === "summary_review") {
          if (fields.assignedUserId !== undefined) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Cannot reassign a summary review task" });
          }
          if (fields.status === "not_assigned") {
            throw new TRPCError({ code: "FORBIDDEN", message: "Cannot unassign a summary review task" });
          }
          const { remark, status } = fields;
          const [updated] = await tx
            .update(task)
            .set({ remark, status, updatedAt: new Date() })
            .where(and(eq(task.id, id), accessFilter))
            .returning({ id: task.id, title: task.title, status: task.status, taskType: task.taskType, assignedUserId: task.assignedUserId, createdAt: task.createdAt });
          return updated;
        }
        const [updated] = await tx
          .update(task)
          .set({ ...fields, updatedAt: new Date() })
          .where(and(eq(task.id, id), accessFilter))
          .returning({ id: task.id, title: task.title, status: task.status, taskType: task.taskType, assignedUserId: task.assignedUserId, createdAt: task.createdAt });
        return updated;
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (await verifyAdminFromDb(ctx.db, ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN", message: "Admins cannot delete tasks" });
      const accessFilter = or(
        eq(task.assignedUserId, ctx.user.id),
        eq(task.createdByUserId, ctx.user.id)
      );
      const existing = await ctx.db.query.task.findFirst({ where: and(eq(task.id, input.id), accessFilter) });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      if (existing.taskType === "summary_review") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete a summary review task" });
      }
      await ctx.db.delete(task).where(and(eq(task.id, input.id), accessFilter));
    }),

  listUsers: protectedProcedure.query(async ({ ctx }) => {
    const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
    if (isAdmin) {
      return ctx.db.query.user.findMany({
        columns: { id: true, name: true, role: true },
        orderBy: (u, { asc }) => [asc(u.name)],
        limit: 1000,
      });
    }
    // Tasks may only be assigned to people in the user's profile
    // (Doctor / Wellness / Pharmacist / Friends) — no pending requests.
    // Include self so the user can also assign a task to themselves.
    const relatedIds = await getRelatedUserIds(ctx.db, ctx.user.id, { acceptedOnly: true });
    relatedIds.add(ctx.user.id);
    return ctx.db.query.user.findMany({
      where: inArray(user.id, [...relatedIds]),
      columns: { id: true, name: true, role: true },
      orderBy: (u, { asc }) => [asc(u.name)],
      limit: 1000,
    });
  }),
});
