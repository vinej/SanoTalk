import { text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";

export const userProperty = createTable("user_property", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userKeyUniq: uniqueIndex("user_property_user_key_uniq").on(t.userId, t.key),
}));

export const userPropertyRelations = relations(userProperty, ({ one }) => ({
  user: one(user, {
    fields: [userProperty.userId],
    references: [user.id],
  }),
}));

export type UserProperty = typeof userProperty.$inferSelect;
