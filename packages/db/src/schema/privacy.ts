import { pgEnum, text, timestamp, uuid, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createTable, user } from "./auth";

// ─── Consent Records ───────────────────────────────────────────────────────

export const consentTypeEnum = pgEnum("sanotalk_consent_type", [
  "cookies",
  "analytics",
  "privacy_policy",
]);

export const consentRecord = createTable("consent_record", {
  id:             uuid("id").primaryKey().defaultRandom(),
  userId:         text("user_id").references(() => user.id, { onDelete: "cascade" }),
  anonymousId:    text("anonymous_id"),
  consentType:    consentTypeEnum("consent_type").notNull(),
  consented:      boolean("consented").notNull(),
  policyVersion:  text("policy_version").notNull(),
  ipAddress:      text("ip_address"),
  userAgent:      text("user_agent"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  withdrawnAt:    timestamp("withdrawn_at"),
}, (t) => ({
  userIdx: index("consent_record_user_idx").on(t.userId),
  typeIdx: index("consent_record_type_idx").on(t.consentType),
}));

export type ConsentRecord = typeof consentRecord.$inferSelect;

// ─── Data Retention Policy ──────────────────────────────────────────────────

export const dataRetentionPolicy = createTable("data_retention_policy", {
  id:             uuid("id").primaryKey().defaultRandom(),
  dataType:       text("data_type").notNull().unique(),
  retentionDays:  integer("retention_days").notNull(),
  description:    text("description"),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
});

// ─── Breach Register ────────────────────────────────────────────────────────

export const breachSeverityEnum = pgEnum("sanotalk_breach_severity", [
  "low", "medium", "high", "critical",
]);

export const breachStatusEnum = pgEnum("sanotalk_breach_status", [
  "open", "investigating", "resolved",
]);

export const breachRecord = createTable("breach_record", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  title:                text("title").notNull(),
  description:          text("description").notNull(),
  severity:             breachSeverityEnum("severity").notNull(),
  dataTypesAffected:    text("data_types_affected"),
  usersAffected:        integer("users_affected").notNull().default(0),
  discoveredAt:         timestamp("discovered_at").notNull(),
  reportedToCaiAt:      timestamp("reported_to_cai_at"),
  usersNotifiedAt:      timestamp("users_notified_at"),
  remediationSteps:     text("remediation_steps"),
  status:               breachStatusEnum("status").notNull().default("open"),
  createdBy:            text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt:            timestamp("created_at").notNull().defaultNow(),
  updatedAt:            timestamp("updated_at").notNull().defaultNow(),
});

export type BreachRecord = typeof breachRecord.$inferSelect;

// ─── Audit Log ──────────────────────────────────────────────────────────────

export const auditLog = createTable("audit_log", {
  id:             uuid("id").primaryKey().defaultRandom(),
  userId:         text("user_id").references(() => user.id, { onDelete: "set null" }),
  action:         text("action").notNull(),
  targetUserId:   text("target_user_id"),
  resourceType:   text("resource_type"),
  resourceId:     text("resource_id"),
  metadata:       jsonb("metadata"),
  ipAddress:      text("ip_address"),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("audit_log_user_idx").on(t.userId),
  actionIdx: index("audit_log_action_idx").on(t.action),
  createdAtIdx: index("audit_log_created_at_idx").on(t.createdAt),
}));

export type AuditLog = typeof auditLog.$inferSelect;
