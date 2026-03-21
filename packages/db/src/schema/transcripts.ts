import { text, timestamp, uuid, jsonb, real } from "drizzle-orm/pg-core";
import { createTable } from "./auth";
import { talkSession } from "./sessions";
import { user } from "./auth";

export const transcript = createTable("transcript", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => talkSession.id, { onDelete: "cascade" }),
  speakerId: text("speaker_id").references(() => user.id, {
    onDelete: "set null",
  }),
  speakerLabel: text("speaker_label"),
  content: text("content").notNull(),
  confidence: real("confidence"),
  startMs: real("start_ms"),
  endMs: real("end_ms"),
  // Deepgram raw result stored for re-processing
  rawDeepgramResult: jsonb("raw_deepgram_result"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transcriptSummary = createTable("transcript_summary", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => talkSession.id, { onDelete: "cascade" })
    .unique(),
  summary: text("summary").notNull(),
  keyPoints: jsonb("key_points").$type<string[]>(),
  actionItems: jsonb("action_items").$type<string[]>(),
  soapNote: jsonb("soap_note").$type<{
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Transcript = typeof transcript.$inferSelect;
export type TranscriptSummary = typeof transcriptSummary.$inferSelect;
