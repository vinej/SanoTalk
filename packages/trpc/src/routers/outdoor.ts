import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { outdoorLog, outdoorCustomActivity } from "@sanotalk/db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { encryptContent, decryptContent } from "../lib/crypto";

const categoryEnum = z.enum(["walking", "fast_walking", "running", "cycling", "swimming", "hiking", "gardening", "other"]);
const intensityEnum = z.enum(["light", "moderate", "vigorous"]);

const customActivitiesRouter = createTRPCRouter({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db
        .select()
        .from(outdoorCustomActivity)
        .where(eq(outdoorCustomActivity.userId, ctx.user.id))
        .orderBy(desc(outdoorCustomActivity.createdAt));
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      category: categoryEnum,
      intensity: intensityEnum,
      suggestedMins: z.number().int().min(1).max(480).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db.insert(outdoorCustomActivity).values({
        userId: ctx.user.id,
        name: input.name,
        category: input.category,
        intensity: input.intensity,
        suggestedMins: input.suggestedMins ?? 30,
      }).returning({ id: outdoorCustomActivity.id });
      return { id: row!.id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(outdoorCustomActivity)
        .where(and(eq(outdoorCustomActivity.id, input.id), eq(outdoorCustomActivity.userId, ctx.user.id)))
        .returning({ id: outdoorCustomActivity.id });
      if (deleted.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { deleted: true };
    }),
});

export const outdoorRouter = createTRPCRouter({
  customActivities: customActivitiesRouter,

  log: protectedProcedure
    .input(z.object({
      activityId: z.string().min(1).max(200),
      category: categoryEnum,
      intensity: intensityEnum,
      durationSecs: z.number().int().min(1).max(28800),
      distanceM: z.number().int().min(0).optional(),
      notes: z.string().max(500).optional(),
      completedAt: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const completedAt = input.completedAt ? new Date(input.completedAt) : new Date();
      const [row] = await ctx.db.insert(outdoorLog).values({
        userId: ctx.user.id,
        activityId: input.activityId,
        category: input.category,
        intensity: input.intensity,
        durationSecs: input.durationSecs,
        distanceM: input.distanceM ?? null,
        notes: encryptContent(input.notes ?? null),
        completedAt,
      }).returning({ id: outdoorLog.id });
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
      const conditions = [eq(outdoorLog.userId, ctx.user.id)];
      if (input.category) conditions.push(eq(outdoorLog.category, input.category));
      if (input.from) conditions.push(gte(outdoorLog.completedAt, new Date(input.from)));
      if (input.to) conditions.push(lte(outdoorLog.completedAt, new Date(input.to)));

      const rows = await ctx.db
        .select()
        .from(outdoorLog)
        .where(and(...conditions))
        .orderBy(desc(outdoorLog.completedAt))
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
          completedAt: outdoorLog.completedAt,
          category: outdoorLog.category,
          intensity: outdoorLog.intensity,
          durationSecs: outdoorLog.durationSecs,
          distanceM: outdoorLog.distanceM,
        })
        .from(outdoorLog)
        .where(and(
          eq(outdoorLog.userId, ctx.user.id),
          gte(outdoorLog.completedAt, fromDate),
          lte(outdoorLog.completedAt, toDate),
        ))
        .orderBy(desc(outdoorLog.completedAt));

      const totalActivities = rows.length;
      const totalDurationSecs = rows.reduce((sum, r) => sum + r.durationSecs, 0);
      const totalDistanceM = rows.reduce((sum, r) => sum + (r.distanceM ?? 0), 0);

      const byCategory: Record<string, number> = {};
      for (const r of rows) {
        byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
      }

      // Streaks from distinct activity dates
      const activityDates = new Set(
        rows.map(r => r.completedAt.toISOString().slice(0, 10))
      );
      const sortedDates = [...activityDates].sort().reverse();

      let currentStreak = 0;
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

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

      let longestStreak = 0;
      let streak = 0;
      const allDatesAsc = [...activityDates].sort();
      for (let i = 0; i < allDatesAsc.length; i++) {
        if (i === 0) {
          streak = 1;
        } else {
          const prev = new Date(allDatesAsc[i - 1]!);
          const curr = new Date(allDatesAsc[i]!);
          if (curr.getTime() - prev.getTime() === 86400000) {
            streak++;
          } else {
            streak = 1;
          }
        }
        longestStreak = Math.max(longestStreak, streak);
      }

      return { totalActivities, totalDurationSecs, totalDistanceM, byCategory, currentStreak, longestStreak };
    }),

  weekSummary: protectedProcedure
    .query(async ({ ctx }) => {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      weekAgo.setHours(0, 0, 0, 0);

      const rows = await ctx.db
        .select({
          date: sql<string>`date(${outdoorLog.completedAt})`,
          count: sql<number>`count(*)::int`,
          totalMins: sql<number>`(sum(${outdoorLog.durationSecs}) / 60)::int`,
        })
        .from(outdoorLog)
        .where(and(
          eq(outdoorLog.userId, ctx.user.id),
          gte(outdoorLog.completedAt, weekAgo),
        ))
        .groupBy(sql`date(${outdoorLog.completedAt})`);

      const byDate: Record<string, { count: number; totalMins: number }> = {};
      for (const r of rows) {
        byDate[r.date] = { count: r.count, totalMins: r.totalMins };
      }

      const days: { date: string; count: number; totalMins: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        days.push({ date: dateStr, count: byDate[dateStr]?.count ?? 0, totalMins: byDate[dateStr]?.totalMins ?? 0 });
      }
      return days;
    }),

  weeklyGoal: protectedProcedure
    .query(async ({ ctx }) => {
      // Week starts Monday
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=Sun
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
      monday.setHours(0, 0, 0, 0);

      const rows = await ctx.db
        .select({
          intensity: outdoorLog.intensity,
          durationSecs: outdoorLog.durationSecs,
        })
        .from(outdoorLog)
        .where(and(
          eq(outdoorLog.userId, ctx.user.id),
          gte(outdoorLog.completedAt, monday),
        ));

      // WHO: 1 min vigorous = 2 min moderate; light counts as-is
      let moderateEquivMins = 0;
      for (const r of rows) {
        const mins = r.durationSecs / 60;
        if (r.intensity === "vigorous") {
          moderateEquivMins += mins * 2;
        } else {
          moderateEquivMins += mins;
        }
      }

      return {
        moderateEquivMins: Math.round(moderateEquivMins),
        goalMins: 150,
        percentage: Math.min(Math.round((moderateEquivMins / 150) * 100), 100),
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(outdoorLog)
        .where(and(eq(outdoorLog.id, input.id), eq(outdoorLog.userId, ctx.user.id)))
        .returning({ id: outdoorLog.id });
      if (deleted.length === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { deleted: true };
    }),
});
