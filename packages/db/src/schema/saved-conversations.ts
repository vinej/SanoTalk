import { text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";

export const savedConversation = createTable("saved_conversation", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  chatType: text("chat_type").notNull(), // "general" | "companion"
  title: text("title").notNull(),
  messages: jsonb("messages").notNull(), // Array<{ role: string; content: string }>
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const savedConversationRelations = relations(savedConversation, ({ one }) => ({
  user: one(user, {
    fields: [savedConversation.userId],
    references: [user.id],
  }),
}));

export type SavedConversation = typeof savedConversation.$inferSelect;
export type NewSavedConversation = typeof savedConversation.$inferInsert;
