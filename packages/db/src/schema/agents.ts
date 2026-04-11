import { text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createTable, user } from "./auth";
import { talkSession } from "./sessions";

// Mastra agent execution logs
export const agentRun = createTable("agent_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => talkSession.id, {
    onDelete: "set null",
  }),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  agentName: text("agent_name").notNull(),
  input: text("input"),                  // encrypted JSON
  output: text("output"),                // encrypted JSON
  status: text("status", {
    enum: ["pending", "running", "success", "error"],
  }).notNull().default("pending"),
  errorMessage: text("error_message"),   // encrypted
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type AgentRun = typeof agentRun.$inferSelect;
