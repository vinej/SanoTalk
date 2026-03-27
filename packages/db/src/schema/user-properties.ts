import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";

export const userProperty = createTable("user_property", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const userPropertyRelations = relations(userProperty, ({ one }) => ({
  user: one(user, {
    fields: [userProperty.userId],
    references: [user.id],
  }),
}));

export type UserProperty = typeof userProperty.$inferSelect;
