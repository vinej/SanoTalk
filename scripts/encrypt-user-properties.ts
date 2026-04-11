/**
 * One-shot script: encrypt all plaintext values in sanotalk_user_property.
 *
 * Rows whose value already starts with "enc:v1:" are skipped.
 *
 * Usage:  npx tsx scripts/encrypt-user-properties.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env") });

import { createCipheriv, randomBytes } from "crypto";
import postgres from "postgres";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set");

  const sql = postgres(dbUrl);

  // Fetch all rows whose value is NOT already encrypted
  const rows = await sql`
    SELECT id, key, value
    FROM sanotalk_user_property
    WHERE value NOT LIKE 'enc:v1:%'
  `;

  console.log(`Found ${rows.length} plaintext rows to encrypt.`);

  if (rows.length === 0) {
    console.log("Nothing to do.");
    await sql.end();
    return;
  }

  let updated = 0;
  for (const row of rows) {
    const encrypted = encrypt(row.value);
    await sql`
      UPDATE sanotalk_user_property
      SET value = ${encrypted}, updated_at = now()
      WHERE id = ${row.id}
    `;
    updated++;
    console.log(`  [${updated}/${rows.length}] Encrypted key="${row.key}" (id=${row.id})`);
  }

  console.log(`Done. Encrypted ${updated} rows.`);
  await sql.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
