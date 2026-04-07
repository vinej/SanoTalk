import { text, timestamp, uuid, smallint, real, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";

// ── User's favorite ER facilities ────────────────────────────────────────────

export const erFavorite = createTable("er_favorite", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  facilityName: text("facility_name").notNull(),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userFacilityIdx: uniqueIndex("er_favorite_user_facility_idx").on(t.userId, t.facilityName),
  userIdx: index("er_favorite_user_idx").on(t.userId),
}));

export const erFavoriteRelations = relations(erFavorite, ({ one }) => ({
  user: one(user, {
    fields: [erFavorite.userId],
    references: [user.id],
  }),
}));

export type ErFavorite = typeof erFavorite.$inferSelect;

// ── ER snapshot time-series (global, no user FK) ─────────────────────────────

export const erSnapshot = createTable("er_snapshot", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  facilityName:       text("facility_name").notNull(),
  occupancyRate:      smallint("occupancy_rate"),
  patientsWaiting:    smallint("patients_waiting").notNull(),
  avgWaitHours:       real("avg_wait_hours").notNull(),
  stretcherCount:     smallint("stretcher_count").notNull(),
  stretchersOccupied: smallint("stretchers_occupied").notNull(),
  patientsOver24h:    smallint("patients_over_24h").notNull(),
  patientsOver48h:    smallint("patients_over_48h").notNull(),
  snapshotAt:         timestamp("snapshot_at").notNull().defaultNow(),
}, (t) => ({
  facilityTimeIdx: index("er_snapshot_facility_time_idx").on(t.facilityName, t.snapshotAt),
  timeIdx: index("er_snapshot_time_idx").on(t.snapshotAt),
}));

export type ErSnapshot = typeof erSnapshot.$inferSelect;
