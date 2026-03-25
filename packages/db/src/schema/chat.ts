import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable } from "./auth";
import { talkSession } from "./sessions";

export const chatMessage = createTable("chat_message", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => talkSession.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  session: one(talkSession, {
    fields: [chatMessage.sessionId],
    references: [talkSession.id],
  }),
}));

export type ChatMessage = typeof chatMessage.$inferSelect;
