import { text, timestamp, uuid, boolean, integer, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";
import { medication } from "./medications";

// ─── Agenda Event — User-created appointments & exercise reminders ──────────

export const agendaEvent = createTable("agenda_event", {
  id:             uuid("id").primaryKey().defaultRandom(),
  userId:         text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  eventType:      text("event_type", { enum: ["appointment", "exercise", "personal", "birthday", "reservation", "other"] }).notNull(),
  title:          text("title").notNull(),            // encrypted
  description:    text("description"),                // encrypted
  location:       text("location"),                   // encrypted
  startAt:        timestamp("start_at").notNull(),
  endAt:          timestamp("end_at"),
  allDay:         boolean("all_day").notNull().default(false),
  recurrenceRule: text("recurrence_rule"),             // JSON: { freq, daysOfWeek?, until? }
  color:          text("color"),                       // optional hex override
  createdAt:      timestamp("created_at").notNull().defaultNow(),
  updatedAt:      timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userIdx:        index("agenda_event_user_idx").on(t.userId),
  userStartIdx:   index("agenda_event_user_start_idx").on(t.userId, t.startAt),
}));

export const agendaEventRelations = relations(agendaEvent, ({ one }) => ({
  user: one(user, {
    fields: [agendaEvent.userId],
    references: [user.id],
  }),
}));

// ─── Availability Slot — Doctor/pharmacist weekly availability ──────────────

export const availabilitySlot = createTable("availability_slot", {
  id:               uuid("id").primaryKey().defaultRandom(),
  professionalId:   text("professional_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  dayOfWeek:        integer("day_of_week").notNull(),   // 0=Sun … 6=Sat
  startTime:        text("start_time").notNull(),       // "09:00" HH:mm
  endTime:          text("end_time").notNull(),         // "12:00" HH:mm
  slotDurationMins: integer("slot_duration_mins").notNull().default(30),
  isActive:         boolean("is_active").notNull().default(true),
  createdAt:        timestamp("created_at").notNull().defaultNow(),
  updatedAt:        timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  profIdx:        index("availability_slot_prof_idx").on(t.professionalId),
  profDayIdx:     index("availability_slot_prof_day_idx").on(t.professionalId, t.dayOfWeek),
  profDayTimeUnq: unique("availability_slot_prof_day_time_unq").on(t.professionalId, t.dayOfWeek, t.startTime),
}));

export const availabilitySlotRelations = relations(availabilitySlot, ({ one }) => ({
  professional: one(user, {
    fields: [availabilitySlot.professionalId],
    references: [user.id],
  }),
}));

// ─── Medication Schedule — Structured reminder times per medication ─────────

export const medicationSchedule = createTable("medication_schedule", {
  id:           uuid("id").primaryKey().defaultRandom(),
  medicationId: uuid("medication_id").notNull().references(() => medication.id, { onDelete: "cascade" }),
  userId:       text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  timeOfDay:    text("time_of_day").notNull(),   // "08:00" HH:mm
  label:        text("label"),                   // encrypted ("Morning dose")
  isActive:     boolean("is_active").notNull().default(true),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("medication_schedule_user_idx").on(t.userId),
  medIdx:  index("medication_schedule_med_idx").on(t.medicationId),
}));

export const medicationScheduleRelations = relations(medicationSchedule, ({ one }) => ({
  user: one(user, {
    fields: [medicationSchedule.userId],
    references: [user.id],
  }),
  medication: one(medication, {
    fields: [medicationSchedule.medicationId],
    references: [medication.id],
  }),
}));

// ─── Type exports ───────────────────────────────────────────────────────────

export type AgendaEvent = typeof agendaEvent.$inferSelect;
export type NewAgendaEvent = typeof agendaEvent.$inferInsert;
export type AvailabilitySlot = typeof availabilitySlot.$inferSelect;
export type MedicationSchedule = typeof medicationSchedule.$inferSelect;
