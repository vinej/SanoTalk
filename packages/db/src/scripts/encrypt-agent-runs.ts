/**
 * One-time migration script: encrypt existing unencrypted data in sanotalk_agent_run.
 *
 * Columns migrated: input, output, error_message
 *
 * Run from repo root:
 *   npx tsx packages/db/src/scripts/encrypt-agent-runs.ts
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env") });

import { createCipheriv, randomBytes } from "crypto";
import postgres from "postgres";

// ─── Inline encryption (same algorithm as @sanotalk/trpc/lib/crypto) ─────────
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

// ─── Main ────────────────────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString) { console.error("DATABASE_URL is not set"); process.exit(1); }
if (!process.env.ENCRYPTION_KEY) { console.error("ENCRYPTION_KEY is not set"); process.exit(1); }

const sql = postgres(connectionString);

async function main() {
  console.log("Fetching all agent_run rows...");

  const rows = await sql`
    SELECT id, input, output, error_message
    FROM sanotalk_agent_run
  `;

  console.log(`Found ${rows.length} rows. Processing...`);

  let updated = 0;

  for (const row of rows) {
    const changes: Record<string, string | null> = {};

    // --- input ---
    if (row.input != null) {
      const val = String(row.input);
      if (!val.startsWith(PREFIX)) {
        // Old jsonb data comes back as an object from postgres driver
        const textToEncrypt = typeof row.input === "object"
          ? JSON.stringify(row.input)
          : val;
        changes.input = encrypt(textToEncrypt);
      }
    }

    // --- output ---
    if (row.output != null) {
      const val = String(row.output);
      if (!val.startsWith(PREFIX)) {
        const textToEncrypt = typeof row.output === "object"
          ? JSON.stringify(row.output)
          : val;
        changes.output = encrypt(textToEncrypt);
      }
    }

    // --- error_message ---
    if (row.error_message != null) {
      const val = String(row.error_message);
      if (!val.startsWith(PREFIX)) {
        changes.error_message = encrypt(val);
      }
    }

    if (Object.keys(changes).length > 0) {
      const cols = Object.keys(changes);
      const vals = Object.values(changes);
      const setClauses = cols.map((col, i) => `${col} = $${i + 2}`).join(", ");

      await sql.unsafe(
        `UPDATE sanotalk_agent_run SET ${setClauses} WHERE id = $1`,
        [row.id, ...vals],
      );
      updated++;
    }
  }

  console.log(`Done. Encrypted ${updated} of ${rows.length} rows.`);
  await sql.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
