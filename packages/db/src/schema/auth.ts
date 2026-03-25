import {
  pgTableCreator,
  text,
  timestamp,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const createTable = pgTableCreator((name) => `sanotalk_${name}`);

// ─── Better Auth required tables ───────────────────────────────────────────

export const user = createTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // SanoTalk-specific profile fields
  role: text("role", { enum: ["patient", "doctor", "pharmacist", "ia_agent"] })
    .notNull()
    .default("patient"),
  specialty: text("specialty"),
  licenseNumber: text("license_number"),
  linkedDoctorId: text("linked_doctor_id").references((): any => user.id, { onDelete: "set null" }),
  linkedPharmacistId: text("linked_pharmacist_id").references((): any => user.id, { onDelete: "set null" }),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(true),
});

export const session = createTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = createTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = createTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Relations (required for drizzle adapter experimental joins) ───────────

export const userRelations = relations(user, ({ many, one }) => ({
  accounts: many(account),
  sessions: many(session),
  linkedDoctor: one(user, {
    fields: [user.linkedDoctorId],
    references: [user.id],
    relationName: "patientDoctor",
  }),
  linkedPharmacist: one(user, {
    fields: [user.linkedPharmacistId],
    references: [user.id],
    relationName: "patientPharmacist",
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
