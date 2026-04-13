import type { IncomingMessage } from "node:http";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { appendFile } from "node:fs/promises";
import * as path from "node:path";
import { auditLog } from "@sanotalk/db";

const AUDIT_FALLBACK_PATH = process.env.AUDIT_FALLBACK_PATH ?? path.join(process.cwd(), "audit-fallback.log");

interface AuditEvent {
  userId?: string | null;
  action: string;
  targetUserId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

/** Extract IP and User-Agent from a Node request for audit logging. */
export function requestMeta(req: IncomingMessage | undefined | null): { ipAddress: string; userAgent: string } {
  if (!req) return { ipAddress: "", userAgent: "" };
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0]!.trim() : req.socket?.remoteAddress ?? "";
  const ua = (typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "") ?? "";
  return { ipAddress: ip, userAgent: ua };
}

export async function logAuditEvent(db: PostgresJsDatabase<any>, event: AuditEvent) {
  try {
    await db.insert(auditLog).values({
      userId: event.userId ?? null,
      action: event.action,
      targetUserId: event.targetUserId ?? null,
      resourceType: event.resourceType ?? null,
      resourceId: event.resourceId ?? null,
      metadata: event.metadata ?? null,
      ipAddress: event.ipAddress ?? null,
      userAgent: event.userAgent ?? null,
      sessionId: event.sessionId ?? null,
    });
  } catch (err) {
    // Audit logging should never break the main operation, but log the failure
    // so observability tooling can alert on persistent audit write issues.
    const errMsg = err instanceof Error ? err.message : String(err);
    process.stderr.write(JSON.stringify({
      level: 50,
      time: Date.now(),
      msg: `[audit] failed to log event: ${event.action} — ${errMsg}`,
    }) + "\n");
    // Persist to a local fallback file so the audit trail is not lost if
    // the DB (or downstream log shipper) is unavailable.
    try {
      await appendFile(AUDIT_FALLBACK_PATH, JSON.stringify({ ts: Date.now(), event, err: errMsg }) + "\n");
    } catch {
      // If even the fallback write fails, there is nowhere left to go — stderr is the last resort.
    }
  }
}
