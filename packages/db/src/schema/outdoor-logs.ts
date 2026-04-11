import { text, timestamp, uuid, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";

/* ── User-created custom activities ── */

export const outdoorCustomActivity = createTable("outdoor_custom_activity", {
  id:            uuid("id").primaryKey().defaultRandom(),
  userId:        text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name:          text("name").notNull(),
  category:      text("category", {
                   enum: ["walking", "fast_walking", "running", "cycling", "swimming", "hiking", "gardening", "other"],
                 }).notNull(),
  intensity:     text("intensity", {
                   enum: ["light", "moderate", "vigorous"],
                 }).notNull(),
  suggestedMins: integer("suggested_mins").notNull().default(30),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("outdoor_custom_activity_user_idx").on(t.userId),
}));

export const outdoorCustomActivityRelations = relations(outdoorCustomActivity, ({ one }) => ({
  user: one(user, {
    fields: [outdoorCustomActivity.userId],
    references: [user.id],
  }),
}));

/* ── Outdoor activity logs (preset or custom) ── */

export const outdoorLog = createTable("outdoor_log", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  activityId:   text("activity_id").notNull(),
  category:     text("category", {
                  enum: ["walking", "fast_walking", "running", "cycling", "swimming", "hiking", "gardening", "other"],
                }).notNull(),
  intensity:    text("intensity", {
                  enum: ["light", "moderate", "vigorous"],
                }).notNull(),
  durationSecs: integer("duration_secs").notNull(),
  distanceM:    integer("distance_m"),
  notes:        text("notes"),
  completedAt:  timestamp("completed_at").notNull(),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("outdoor_log_user_idx").on(t.userId),
  userCompletedIdx: index("outdoor_log_user_completed_idx").on(t.userId, t.completedAt),
}));

export const outdoorLogRelations = relations(outdoorLog, ({ one }) => ({
  user: one(user, {
    fields: [outdoorLog.userId],
    references: [user.id],
  }),
}));

export type OutdoorCustomActivity = typeof outdoorCustomActivity.$inferSelect;
export type OutdoorLog = typeof outdoorLog.$inferSelect;
export type OutdoorCategory = OutdoorLog["category"];
export type OutdoorIntensity = OutdoorLog["intensity"];
