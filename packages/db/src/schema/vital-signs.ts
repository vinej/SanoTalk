import { text, timestamp, uuid, real, index, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createTable, user } from "./auth";

export const vitalSign = createTable("vital_sign", {
  id:             uuid("id").primaryKey().defaultRandom(),
  userId:         text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  type:           text("type", {
                    enum: ["blood_pressure", "heart_rate", "weight", "blood_glucose", "temperature", "oxygen_saturation"],
                  }).notNull(),
  valuePrimary:   real("value_primary").notNull(),
  valueSecondary: real("value_secondary"),
  unit:           text("unit").notNull(),
  notes:          text("notes"),
  source:         text("source").notNull().default("manual"),
  measuredAt:     timestamp("measured_at").notNull(),
  createdAt:      timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userTypeIdx: index("vital_sign_user_type_idx").on(t.userId, t.type),
  measuredAtIdx: index("vital_sign_measured_at_idx").on(t.userId, t.measuredAt),
  valuePrimaryRange: check("vital_sign_value_primary_range", sql`${t.valuePrimary} >= 0 AND ${t.valuePrimary} <= 1000`),
  valueSecondaryRange: check("vital_sign_value_secondary_range", sql`${t.valueSecondary} IS NULL OR (${t.valueSecondary} >= 0 AND ${t.valueSecondary} <= 500)`),
}));

export const vitalSignRelations = relations(vitalSign, ({ one }) => ({
  user: one(user, {
    fields: [vitalSign.userId],
    references: [user.id],
  }),
}));

export type VitalSign = typeof vitalSign.$inferSelect;
export type VitalType = VitalSign["type"];
