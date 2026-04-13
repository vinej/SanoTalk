import { text, timestamp, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";

export const wearableConnection = createTable("wearable_connection", {
  id:               uuid("id").primaryKey().defaultRandom(),
  userId:           text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  provider:         text("provider").notNull(), // "GARMIN" | "FITBIT" | "GOOGLE" | future vendors
  terraUserId:      text("terra_user_id").notNull(),
  scopes:           text("scopes"),
  status:           text("status", { enum: ["active", "revoked", "error"] }).notNull().default("active"),
  connectedAt:      timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  lastSyncedAt:     timestamp("last_synced_at", { withTimezone: true }),
  lastErrorAt:      timestamp("last_error_at", { withTimezone: true }),
  lastErrorMessage: text("last_error_message"),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx:         index("wearable_connection_user_idx").on(t.userId),
  terraUserIdUniq: uniqueIndex("wearable_connection_terra_user_id_uniq").on(t.terraUserId),
}));

export const wearableConnectionRelations = relations(wearableConnection, ({ one }) => ({
  user: one(user, {
    fields: [wearableConnection.userId],
    references: [user.id],
  }),
}));

export type WearableConnection = typeof wearableConnection.$inferSelect;
export type WearableProvider = "GARMIN" | "FITBIT" | "GOOGLE";
