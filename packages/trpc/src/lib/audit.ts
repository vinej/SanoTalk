import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { auditLog } from "@sanotalk/db";

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
    process.stderr.write(JSON.stringify({
      level: 50,
      time: Date.now(),
      msg: `[audit] failed to log event: ${event.action} — ${err instanceof Error ? err.message : String(err)}`,
    }) + "\n");
  }
}
