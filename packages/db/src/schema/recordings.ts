import { text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";
import { createTable } from "./auth";
import { talkSession } from "./sessions";

export const recording = createTable("recording", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => talkSession.id, { onDelete: "cascade" }),
  // MinIO / S3 object key
  storageKey: text("storage_key").notNull(),
  storageBucket: text("storage_bucket").notNull().default("sanotalk"),
  mimeType: text("mime_type").notNull().default("video/mp4"),
  sizeBytes: integer("size_bytes"),
  durationMs: integer("duration_ms"),
  isProcessed: boolean("is_processed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Recording = typeof recording.$inferSelect;
