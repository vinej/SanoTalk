import { text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";

export const aiAssistantProfile = createTable("ai_assistant_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["wellness", "health_specialist", "friend"] }).notNull(),
  gender: text("gender", { enum: ["male", "female"] }).notNull(),
  voiceId: text("voice_id").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  personality: text("personality").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiAssistantProfileRelations = relations(aiAssistantProfile, ({ one }) => ({
  user: one(user, {
    fields: [aiAssistantProfile.userId],
    references: [user.id],
  }),
}));

export type AiAssistantProfile = typeof aiAssistantProfile.$inferSelect;
export type NewAiAssistantProfile = typeof aiAssistantProfile.$inferInsert;
