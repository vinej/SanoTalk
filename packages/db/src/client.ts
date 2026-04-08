import { config } from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Disable prefetch as it's not supported for "Transaction" pool mode
const client = postgres(connectionString, {
  prepare: false,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
  max: parseInt(process.env.DB_POOL_MAX ?? "20"),
  idle_timeout: 30,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
});

export const db = drizzle(client, { schema });
export type DB = typeof db;
