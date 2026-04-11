import { auditLog } from "@sanotalk/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const DAILY_SHARE_LIMIT = 20;

/**
 * Throws TOO_MANY_REQUESTS if the user has exceeded the daily share limit.
 * Uses audit_log entries with action "share_data" created in the last 24 hours.
 */
export async function checkDailyShareLimit(db: any, userId: string): Promise<void> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.userId, userId),
        eq(auditLog.action, "share_data"),
        gte(auditLog.createdAt, oneDayAgo),
      ),
    );
  if ((result?.count ?? 0) >= DAILY_SHARE_LIMIT) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Daily share limit reached" });
  }
}
