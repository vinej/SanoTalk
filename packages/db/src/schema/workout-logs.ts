import { text, timestamp, uuid, integer, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";

export const workoutLog = createTable("workout_log", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  exerciseId:   text("exercise_id").notNull(),
  category:     text("category", {
                  enum: ["tai_chi", "stretching", "balance", "strength", "cardio"],
                }).notNull(),
  difficulty:   text("difficulty", {
                  enum: ["beginner", "intermediate", "advanced"],
                }).notNull(),
  durationSecs: integer("duration_secs").notNull(),
  notes:        text("notes"),
  completedAt:  timestamp("completed_at").notNull(),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("workout_log_user_idx").on(t.userId),
  userCompletedIdx: index("workout_log_user_completed_idx").on(t.userId, t.completedAt),
}));

export const workoutLogRelations = relations(workoutLog, ({ one }) => ({
  user: one(user, {
    fields: [workoutLog.userId],
    references: [user.id],
  }),
}));

export type WorkoutLog = typeof workoutLog.$inferSelect;
export type ExerciseCategory = WorkoutLog["category"];
export type DifficultyLevel = WorkoutLog["difficulty"];
