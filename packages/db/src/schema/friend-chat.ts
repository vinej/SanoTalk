import { text, timestamp, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user } from "./auth";

// ─── Friend chat rooms (ephemeral messaging, no message content stored) ────

export const friendChatRoom = createTable("friend_chat_room", {
  id:             uuid("id").primaryKey().defaultRandom(),
  roomName:       text("room_name").notNull().unique(),
  createdById:    text("created_by_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name:           text("name"),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const friendChatRoomRelations = relations(friendChatRoom, ({ one, many }) => ({
  createdBy:    one(user, { fields: [friendChatRoom.createdById], references: [user.id] }),
  participants: many(friendChatParticipant),
}));

// ─── Participants in a friend chat room ────────────────────────────────────

export const friendChatParticipant = createTable("friend_chat_participant", {
  id:       uuid("id").primaryKey().defaultRandom(),
  roomId:   uuid("room_id").notNull().references(() => friendChatRoom.id, { onDelete: "cascade" }),
  userId:   text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("friend_chat_participant_room_user_uniq").on(t.roomId, t.userId),
  roomIdx: index("friend_chat_participant_room_idx").on(t.roomId),
}));

export const friendChatParticipantRelations = relations(friendChatParticipant, ({ one }) => ({
  room: one(friendChatRoom, { fields: [friendChatParticipant.roomId], references: [friendChatRoom.id] }),
  user: one(user, { fields: [friendChatParticipant.userId], references: [user.id] }),
}));
