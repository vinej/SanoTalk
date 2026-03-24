import { text } from "drizzle-orm/pg-core";
import { createTable, user } from "./auth";

export const twoFactor = createTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret"),
  backupCodes: text("backup_codes"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
