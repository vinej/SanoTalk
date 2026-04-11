import { text, timestamp, uuid, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";
import { medicationSchedule } from "./agenda";

export const medication = createTable("medication", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name:         text("name").notNull(),
  dosage:       text("dosage").notNull(),
  frequency:    text("frequency").notNull(),
  route:        text("route"),
  prescribedBy: text("prescribed_by"),
  reason:       text("reason"),
  startDate:    timestamp("start_date").notNull(),
  endDate:      timestamp("end_date"),
  isActive:     boolean("is_active").notNull().default(true),
  notes:        text("notes"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userIdIdx: index("medication_user_id_idx").on(t.userId),
  userActiveIdx: index("medication_user_active_idx").on(t.userId, t.isActive),
}));

export const medicationRelations = relations(medication, ({ one, many }) => ({
  user: one(user, {
    fields: [medication.userId],
    references: [user.id],
  }),
  schedules: many(medicationSchedule),
}));

export type Medication = typeof medication.$inferSelect;
