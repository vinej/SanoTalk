import { text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createTable } from "./auth";
import { talkSession } from "./sessions";

// Mastra agent execution logs
export const agentRun = createTable("agent_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => talkSession.id, {
    onDelete: "set null",
  }),
  agentName: text("agent_name").notNull(),
  input: jsonb("input"),
  output: jsonb("output"),
  status: text("status", {
    enum: ["pending", "running", "success", "error"],
  }).notNull().default("pending"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type AgentRun = typeof agentRun.$inferSelect;
