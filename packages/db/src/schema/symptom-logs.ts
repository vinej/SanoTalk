import { text, timestamp, uuid, smallint, real, date, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createTable, user } from "./auth";

export const symptomLog = createTable("symptom_log", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  date:            date("date", { mode: "string" }).notNull(),
  painLevel:       smallint("pain_level"),
  mood:            smallint("mood"),
  energy:          smallint("energy"),
  sleepQuality:    smallint("sleep_quality"),
  sleepHours:      real("sleep_hours"),
  stress:          smallint("stress"),
  appetite:        smallint("appetite"),
  customSymptoms:  text("custom_symptoms").array(),
  bodyLocation:    text("body_location"),
  notes:           text("notes"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userDateIdx: uniqueIndex("symptom_log_user_date_idx").on(t.userId, t.date),
  userIdIdx: index("symptom_log_user_id_idx").on(t.userId),
  painRange: check("symptom_log_pain_range", sql`${t.painLevel} IS NULL OR (${t.painLevel} >= 0 AND ${t.painLevel} <= 10)`),
  moodRange: check("symptom_log_mood_range", sql`${t.mood} IS NULL OR (${t.mood} >= 0 AND ${t.mood} <= 10)`),
  energyRange: check("symptom_log_energy_range", sql`${t.energy} IS NULL OR (${t.energy} >= 0 AND ${t.energy} <= 10)`),
  sleepQualityRange: check("symptom_log_sleep_quality_range", sql`${t.sleepQuality} IS NULL OR (${t.sleepQuality} >= 0 AND ${t.sleepQuality} <= 10)`),
  sleepHoursRange: check("symptom_log_sleep_hours_range", sql`${t.sleepHours} IS NULL OR (${t.sleepHours} >= 0 AND ${t.sleepHours} <= 24)`),
  stressRange: check("symptom_log_stress_range", sql`${t.stress} IS NULL OR (${t.stress} >= 0 AND ${t.stress} <= 10)`),
  appetiteRange: check("symptom_log_appetite_range", sql`${t.appetite} IS NULL OR (${t.appetite} >= 0 AND ${t.appetite} <= 10)`),
}));

export const symptomLogRelations = relations(symptomLog, ({ one }) => ({
  user: one(user, {
    fields: [symptomLog.userId],
    references: [user.id],
  }),
}));

export type SymptomLog = typeof symptomLog.$inferSelect;
