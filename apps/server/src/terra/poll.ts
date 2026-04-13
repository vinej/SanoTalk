import { db } from "@sanotalk/db";
import { wearableConnection, vitalSign } from "@sanotalk/db";
import { eq, and, lt, isNull, or } from "drizzle-orm";
import { logger } from "../logger";
import { getBody, getDaily } from "./client";
import { mapTerraBodyPayload, mapTerraDailyPayload } from "./mapper";

const ONE_MIN_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MIN_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

// Per-connection mutex so the interval doesn't overlap itself if a sync runs
// long. We don't need cross-process coordination — single server instance.
const inFlight = new Set<string>();

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  if (raw === "false" || raw === "0" || raw === "no") return false;
  return fallback;
}

export interface TerraPollConfig {
  intervalMs: number;       // how often runReconcilePoll() is invoked. 0 = disabled.
  minAgeMs: number;         // skip a connection if synced more recently than this
  includeBody: boolean;     // fetch /v2/body
  includeDaily: boolean;    // fetch /v2/daily
  backstopDays: number;     // max days back the sliding window can reach
}

export function loadPollConfig(): TerraPollConfig {
  return {
    intervalMs: intEnv("TERRA_POLL_INTERVAL_MIN", 30) * ONE_MIN_MS,
    minAgeMs:   intEnv("TERRA_POLL_MIN_AGE_MIN", 60) * ONE_MIN_MS,
    includeBody:  boolEnv("TERRA_POLL_INCLUDE_BODY", true),
    includeDaily: boolEnv("TERRA_POLL_INCLUDE_DAILY", true),
    backstopDays: intEnv("TERRA_POLL_BACKSTOP_DAYS", 7),
  };
}

/**
 * Reconcile poll: catch up any wearable measurements that didn't arrive via
 * webhook (endpoint downtime, vendor delays, etc).
 *
 * Tunable via env (see TerraPollConfig). Defaults: 30-min interval, skip
 * connections synced in the last hour, fetch both /body and /daily, look back
 * at most 7 days. Set TERRA_POLL_INTERVAL_MIN=0 to disable polling entirely
 * and rely on webhooks alone — the cheapest mode if you trust your webhook
 * uptime and Terra's vendor delivery.
 */
export async function runReconcilePoll(config?: TerraPollConfig): Promise<void> {
  if (!process.env.TERRA_API_KEY || !process.env.TERRA_DEV_ID) {
    return; // Terra not configured; skip silently
  }
  const cfg = config ?? loadPollConfig();
  if (!cfg.includeBody && !cfg.includeDaily) {
    return; // explicitly disabled all endpoints
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - cfg.minAgeMs);

  const conns = await db
    .select({
      id: wearableConnection.id,
      userId: wearableConnection.userId,
      terraUserId: wearableConnection.terraUserId,
      provider: wearableConnection.provider,
      lastSyncedAt: wearableConnection.lastSyncedAt,
    })
    .from(wearableConnection)
    .where(and(
      eq(wearableConnection.status, "active"),
      or(isNull(wearableConnection.lastSyncedAt), lt(wearableConnection.lastSyncedAt, cutoff))
    ));

  if (conns.length === 0) return;

  logger.info({ count: conns.length, cfg }, "Terra reconcile poll: starting");

  for (const conn of conns) {
    if (inFlight.has(conn.id)) continue;
    inFlight.add(conn.id);

    try {
      const backstopMs = cfg.backstopDays * ONE_DAY_MS;
      const since = conn.lastSyncedAt
        ? new Date(Math.max(conn.lastSyncedAt.getTime() - ONE_HOUR_MS, now.getTime() - backstopMs))
        : new Date(now.getTime() - backstopMs);
      const range = { startDate: fmtDate(since), endDate: fmtDate(now) };

      // Only call the endpoints we're configured to use — each call costs credits.
      const calls: Promise<unknown>[] = [];
      const labels: Array<"body" | "daily"> = [];
      if (cfg.includeBody)  { calls.push(getBody(conn.terraUserId, range));  labels.push("body"); }
      if (cfg.includeDaily) { calls.push(getDaily(conn.terraUserId, range)); labels.push("daily"); }

      const results = await Promise.allSettled(calls);

      const rows = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i]!;
        const label = labels[i]!;
        if (r.status !== "fulfilled") {
          logger.warn({ err: r.reason, terraUserId: conn.terraUserId, label }, "Terra poll endpoint failed");
          continue;
        }
        if (label === "body") {
          rows.push(...mapTerraBodyPayload(r.value as never, conn.userId));
        } else {
          rows.push(...mapTerraDailyPayload(r.value as never, conn.userId));
        }
      }

      if (rows.length > 0) {
        await db.insert(vitalSign).values(rows).onConflictDoNothing();
      }

      await db
        .update(wearableConnection)
        .set({ lastSyncedAt: now, updatedAt: now, lastErrorAt: null, lastErrorMessage: null })
        .where(eq(wearableConnection.id, conn.id));

      logger.info({ connId: conn.id, count: rows.length }, "Terra reconcile poll: synced");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, connId: conn.id }, "Terra reconcile poll: connection failed");
      await db
        .update(wearableConnection)
        .set({ lastErrorAt: now, lastErrorMessage: message.slice(0, 500), updatedAt: now })
        .where(eq(wearableConnection.id, conn.id));
    } finally {
      inFlight.delete(conn.id);
    }
  }
}
