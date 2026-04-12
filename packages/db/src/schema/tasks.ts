import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";

export const task = createTable("task", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["not_assigned", "assigned", "completed"],
  })
    .notNull()
    .default("not_assigned"),
  assignedUserId: text("assigned_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  taskType: text("task_type", {
    enum: ["standard", "summary_review"],
  })
    .notNull()
    .default("standard"),
  remark: text("remark"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskRelations = relations(task, ({ one }) => ({
  assignedUser: one(user, {
    fields: [task.assignedUserId],
    references: [user.id],
  }),
}));

export type Task = typeof task.$inferSelect;
export type NewTask = typeof task.$inferInsert;
