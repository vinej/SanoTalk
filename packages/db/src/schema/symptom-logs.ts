import { text, timestamp, uuid, smallint, real, date, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
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
}));

export const symptomLogRelations = relations(symptomLog, ({ one }) => ({
  user: one(user, {
    fields: [symptomLog.userId],
    references: [user.id],
  }),
}));

export type SymptomLog = typeof symptomLog.$inferSelect;
