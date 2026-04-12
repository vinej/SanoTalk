import { text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable, user, account, session } from "./auth";
import { agendaEvent, availabilitySlot } from "./agenda";

// ─── Professional links (patient ↔ doctor/pharmacist) ──────────────────────

export const userLink = createTable("user_link", {
  id:             uuid("id").primaryKey().defaultRandom(),
  patientId:      text("patient_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  professionalId: text("professional_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  linkType:       text("link_type").notNull().default("doctor"),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("user_link_patient_professional_type_uniq").on(t.patientId, t.professionalId, t.linkType),
}));

export const userLinkRelations = relations(userLink, ({ one }) => ({
  patient:      one(user, { fields: [userLink.patientId],      references: [user.id], relationName: "patientLinks" }),
  professional: one(user, { fields: [userLink.professionalId], references: [user.id], relationName: "professionalLinks" }),
}));

// ─── Friends (any role, directional) ───────────────────────────────────────

export const userFriend = createTable("user_friend", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  friendId:  text("friend_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("user_friend_uniq").on(t.userId, t.friendId),
}));

export const userFriendRelations = relations(userFriend, ({ one }) => ({
  user:   one(user, { fields: [userFriend.userId],   references: [user.id], relationName: "friendsOf" }),
  friend: one(user, { fields: [userFriend.friendId], references: [user.id], relationName: "friendedBy" }),
}));

// ─── Connection requests (pending / accepted / refused) ────────────────────

export const connectionRequest = createTable("connection_request", {
  id:         uuid("id").primaryKey().defaultRandom(),
  fromUserId: text("from_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  toUserId:   text("to_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  type:       text("type", { enum: ["link", "friend"] }).notNull(),
  linkType:   text("link_type").notNull().default("doctor"),
  status:     text("status", { enum: ["pending", "accepted", "refused"] }).notNull().default("pending"),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("connection_request_from_to_type_link_uniq").on(t.fromUserId, t.toUserId, t.type, t.linkType),
}));

export const connectionRequestRelations = relations(connectionRequest, ({ one }) => ({
  fromUser: one(user, { fields: [connectionRequest.fromUserId], references: [user.id], relationName: "sentRequests" }),
  toUser:   one(user, { fields: [connectionRequest.toUserId],   references: [user.id], relationName: "receivedRequests" }),
}));

// ─── Full userRelations defined here to avoid circular imports ─────────────

export const userRelations = relations(user, ({ many }) => ({
  accounts:          many(account),
  sessions:          many(session),
  patientLinks:      many(userLink,          { relationName: "patientLinks" }),
  professionalLinks: many(userLink,          { relationName: "professionalLinks" }),
  friends:           many(userFriend,        { relationName: "friendsOf" }),
  sentRequests:      many(connectionRequest, { relationName: "sentRequests" }),
  receivedRequests:  many(connectionRequest, { relationName: "receivedRequests" }),
  agendaEvents:      many(agendaEvent),
  availabilitySlots: many(availabilitySlot),
}));
