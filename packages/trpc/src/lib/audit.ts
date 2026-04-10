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
    });
  } catch {
    // Audit logging should never break the main operation
  }
}
