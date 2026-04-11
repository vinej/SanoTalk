import { text, timestamp, uuid, date, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";

export const symptomLog = createTable("symptom_log", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  date:            date("date", { mode: "string" }).notNull(),
  painLevel:       text("pain_level"),
  mood:            text("mood"),
  energy:          text("energy"),
  sleepQuality:    text("sleep_quality"),
  sleepHours:      text("sleep_hours"),
  stress:          text("stress"),
  appetite:        text("appetite"),
  customSymptoms:  text("custom_symptoms").array(),
  bodyLocation:    text("body_location"),
  notes:           text("notes"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userDateIdx: uniqueIndex("symptom_log_user_date_idx").on(t.userId, t.date),
  userIdIdx: index("symptom_log_user_id_idx").on(t.userId),
}));

export const symptomLogRelations = relations(symptomLog, ({ one }) => ({
  user: one(user, {
    fields: [symptomLog.userId],
    references: [user.id],
  }),
}));

export type SymptomLog = typeof symptomLog.$inferSelect;
