import { text, timestamp, uuid, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createTable, user } from "./auth";
import { talkSession } from "./sessions";

export const chatMessage = createTable("chat_message", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .references(() => talkSession.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" }),
  chatType: text("chat_type"), // "general" | "companion", null for session messages
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  ownerRequired: check("chat_message_owner_required", sql`${t.userId} IS NOT NULL OR ${t.sessionId} IS NOT NULL`),
}));

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  session: one(talkSession, {
    fields: [chatMessage.sessionId],
    references: [talkSession.id],
  }),
  user: one(user, {
    fields: [chatMessage.userId],
    references: [user.id],
  }),
}));

export type ChatMessage = typeof chatMessage.$inferSelect;
