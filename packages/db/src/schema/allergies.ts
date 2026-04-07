import { text, timestamp, uuid, date, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";

export const allergy = createTable("allergy", {
  id:            uuid("id").primaryKey().defaultRandom(),
  userId:        text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  type:          text("type").notNull(),          // drug | food | environmental | other
  name:          text("name").notNull(),
  severity:      text("severity").notNull(),       // mild | moderate | severe | life_threatening
  reaction:      text("reaction"),
  diagnosedDate: date("diagnosed_date", { mode: "string" }),
  notes:         text("notes"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("allergy_user_id_idx").on(t.userId),
  userNameIdx: uniqueIndex("allergy_user_name_idx").on(t.userId, t.name),
}));

export const allergyRelations = relations(allergy, ({ one }) => ({
  user: one(user, {
    fields: [allergy.userId],
    references: [user.id],
  }),
}));

export const chronicCondition = createTable("chronic_condition", {
  id:            uuid("id").primaryKey().defaultRandom(),
  userId:        text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name:          text("name").notNull(),
  status:        text("status").notNull(),         // active | managed | resolved
  severity:      text("severity").notNull(),       // mild | moderate | severe
  diagnosedDate: date("diagnosed_date", { mode: "string" }),
  medications:   text("medications").array(),
  notes:         text("notes"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userIdx: index("chronic_condition_user_id_idx").on(t.userId),
  userNameIdx: uniqueIndex("chronic_condition_user_name_idx").on(t.userId, t.name),
}));

export const chronicConditionRelations = relations(chronicCondition, ({ one }) => ({
  user: one(user, {
    fields: [chronicCondition.userId],
    references: [user.id],
  }),
}));

export type Allergy = typeof allergy.$inferSelect;
export type ChronicCondition = typeof chronicCondition.$inferSelect;
