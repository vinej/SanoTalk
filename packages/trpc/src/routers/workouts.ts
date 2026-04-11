import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { workoutLog } from "@sanotalk/db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { encryptContent, decryptContent } from "../lib/crypto";

const categoryEnum = z.enum(["tai_chi", "stretching", "balance", "strength", "cardio"]);
const difficultyEnum = z.enum(["beginner", "intermediate", "advanced"]);

export const workoutsRouter = createTRPCRouter({
  log: protectedProcedure
    .input(z.object({
      exerciseId: z.string().min(1).max(100),
      category: categoryEnum,
      difficulty: difficultyEnum,
      durationSecs: z.number().int().min(1).max(7200),
      notes: z.string().max(500).optional(),
      completedAt: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const completedAt = input.completedAt ? new Date(input.completedAt) : new Date();
      const [row] = await ctx.db.insert(workoutLog).values({
        userId: ctx.user.id,
        exerciseId: input.exerciseId,
        category: input.category,
        difficulty: input.difficulty,
        durationSecs: input.durationSecs,
        notes: encryptContent(input.notes ?? null),
        completedAt,
      }).returning({ id: workoutLog.id });
      return { id: row!.id };
    }),

  list: protectedProcedure
    .input(z.object({
      category: categoryEnum.optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z.number().min(1).max(500).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(workoutLog.userId, ctx.user.id)];
      if (input.category) conditions.push(eq(workoutLog.category, input.category));
      if (input.from) conditions.push(gte(workoutLog.completedAt, new Date(input.from)));
      if (input.to) conditions.push(lte(workoutLog.completedAt, new Date(input.to)));

      const rows = await ctx.db
        .select()
        .from(workoutLog)
        .where(and(...conditions))
        .orderBy(desc(workoutLog.completedAt))
        .limit(input.limit ?? 100);
      return rows.map(r => ({ ...r, notes: decryptContent(r.notes) }));
    }),

  stats: protectedProcedure
    .input(z.object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    }))
    .query(async ({ ctx, input }) => {
      const fromDate = new Date(input.from);
      const toDate = new Date(input.to);
      if (fromDate >= toDate) throw new TRPCError({ code: "BAD_REQUEST", message: "from must be before to" });

      const rows = await ctx.db
        .select({
          completedAt: workoutLog.completedAt,
          category: workoutLog.category,
          durationSecs: workoutLog.durationSecs,
        })
        .from(workoutLog)
        .where(and(
          eq(workoutLog.userId, ctx.user.id),
          gte(workoutLog.completedAt, fromDate),
          lte(workoutLog.completedAt, toDate),
        ))
        .orderBy(desc(workoutLog.completedAt));

      const totalWorkouts = rows.length;
      const totalDurationSecs = rows.reduce((sum, r) => sum + r.durationSecs, 0);

      const byCategory: Record<string, number> = {};
      for (const r of rows) {
        byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
      }

      // Compute streaks from distinct workout dates
      const workoutDates = new Set(
        rows.map(r => r.completedAt.toISOString().slice(0, 10))
      );
      const sortedDates = [...workoutDates].sort().reverse();

      let currentStreak = 0;
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      // Current streak: count consecutive days ending today or yesterday
      if (sortedDates[0] === todayStr || sortedDates[0] === yesterdayStr) {
        let checkDate = new Date(sortedDates[0]!);
        for (const d of sortedDates) {
          if (d === checkDate.toISOString().slice(0, 10)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }

      // Longest streak
      let longestStreak = 0;
      let streak = 0;
      const allDatesAsc = [...workoutDates].sort();
      for (let i = 0; i < allDatesAsc.length; i++) {
        if (i === 0) {
          streak = 1;
        } else {
          const prev = new Date(allDatesAsc[i - 1]!);
          const curr = new Date(allDatesAsc[i]!);
          const diffMs = curr.getTime() - prev.getTime();
          if (diffMs === 86400000) {
            streak++;
          } else {
            streak = 1;
          }
        }
        longestStreak = Math.max(longestStreak, streak);
      }

      return { totalWorkouts, totalDurationSecs, byCategory, currentStreak, longestStreak };
    }),

  weekSummary: protectedProcedure
    .query(async ({ ctx }) => {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      weekAgo.setHours(0, 0, 0, 0);

      const rows = await ctx.db
        .select({
          date: sql<string>`date(${workoutLog.completedAt})`,
          count: sql<number>`count(*)::int`,
        })
        .from(workoutLog)
        .where(and(
          eq(workoutLog.userId, ctx.user.id),
          gte(workoutLog.completedAt, weekAgo),
        ))
        .groupBy(sql`date(${workoutLog.completedAt})`);

      const countByDate: Record<string, number> = {};
      for (const r of rows) {
        countByDate[r.date] = r.count;
      }

      const days: { date: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        days.push({ date: dateStr, count: countByDate[dateStr] ?? 0 });
      }

      return days;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(workoutLog)
        .where(and(eq(workoutLog.id, input.id), eq(workoutLog.userId, ctx.user.id)))
        .returning({ id: workoutLog.id });
      if (deleted.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { deleted: true };
    }),
});
