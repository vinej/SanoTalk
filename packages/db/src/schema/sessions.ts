import { pgEnum, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createTable } from "./auth";
import { user } from "./auth";

export const sessionStatusEnum = pgEnum("sanotalk_session_status", [
  "scheduled",
  "active",
  "completed",
  "cancelled",
]);

export const talkSession = createTable("talk_session", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: sessionStatusEnum("status").notNull().default("scheduled"),
  roomName: text("room_name").notNull().unique(),
  hostId: text("host_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessionParticipant = createTable("session_participant", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => talkSession.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at"),
  leftAt: timestamp("left_at"),
  livekitParticipantId: text("livekit_participant_id"),
});

export type TalkSession = typeof talkSession.$inferSelect;
export type NewTalkSession = typeof talkSession.$inferInsert;
