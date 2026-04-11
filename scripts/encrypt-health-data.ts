/**
 * One-shot script: encrypt all plaintext PHI fields in health data tables.
 *
 * Tables covered:
 *   - sanotalk_symptom_log     (custom_symptoms[], body_location, notes)
 *   - sanotalk_vital_sign      (notes)
 *   - sanotalk_medication      (name, dosage, frequency, route, prescribed_by, reason, notes)
 *   - sanotalk_allergy         (name, reaction, notes)
 *   - sanotalk_chronic_condition (name, medications[], notes)
 *
 * Rows whose text fields already start with "enc:v1:" are skipped.
 *
 * Usage:  npx tsx scripts/encrypt-health-data.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env") });

import { createCipheriv, createHash, randomBytes } from "crypto";
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

function encryptIfNeeded(value: string | null): string | null {
  if (!value || value.startsWith(PREFIX)) return value;
  return encrypt(value);
}

function encryptArrayIfNeeded(arr: string[] | null): string[] | null {
  if (!arr) return null;
  return arr.map((el) => (el.startsWith(PREFIX) ? el : encrypt(el)));
}

function hashForIndex(text: string): string {
  return createHash("sha256").update(text.toLowerCase().trim()).digest("hex");
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set");

  const sql = postgres(dbUrl);
  let totalUpdated = 0;

  // ── 1. sanotalk_symptom_log ──────────────────────────────────────────────
  {
    const rows = await sql`
      SELECT id, custom_symptoms, body_location, notes
      FROM sanotalk_symptom_log
      WHERE (notes IS NOT NULL AND notes NOT LIKE 'enc:v1:%')
         OR (body_location IS NOT NULL AND body_location NOT LIKE 'enc:v1:%')
         OR (custom_symptoms IS NOT NULL AND array_length(custom_symptoms, 1) > 0)
    `;

    // Filter to rows that actually need encryption
    const toUpdate = rows.filter((r) => {
      const needNotes = r.notes && !r.notes.startsWith(PREFIX);
      const needBody = r.body_location && !r.body_location.startsWith(PREFIX);
      const needSymptoms = r.custom_symptoms?.some((s: string) => !s.startsWith(PREFIX));
      return needNotes || needBody || needSymptoms;
    });

    console.log(`\n[symptom_log] ${toUpdate.length} rows to encrypt`);
    for (const row of toUpdate) {
      await sql`
        UPDATE sanotalk_symptom_log SET
          notes = ${encryptIfNeeded(row.notes)},
          body_location = ${encryptIfNeeded(row.body_location)},
          custom_symptoms = ${encryptArrayIfNeeded(row.custom_symptoms)},
          updated_at = now()
        WHERE id = ${row.id}
      `;
      totalUpdated++;
      console.log(`  Encrypted symptom_log id=${row.id}`);
    }
  }

  // ── 2. sanotalk_vital_sign ───────────────────────────────────────────────
  {
    const rows = await sql`
      SELECT id, notes
      FROM sanotalk_vital_sign
      WHERE notes IS NOT NULL AND notes NOT LIKE 'enc:v1:%'
    `;
    console.log(`\n[vital_sign] ${rows.length} rows to encrypt`);
    for (const row of rows) {
      await sql`
        UPDATE sanotalk_vital_sign SET
          notes = ${encrypt(row.notes)},
          updated_at = now()
        WHERE id = ${row.id}
      `;
      totalUpdated++;
      console.log(`  Encrypted vital_sign id=${row.id}`);
    }
  }

  // ── 3. sanotalk_medication ───────────────────────────────────────────────
  {
    const rows = await sql`
      SELECT id, name, dosage, frequency, route, prescribed_by, reason, notes
      FROM sanotalk_medication
      WHERE name NOT LIKE 'enc:v1:%'
         OR dosage NOT LIKE 'enc:v1:%'
         OR frequency NOT LIKE 'enc:v1:%'
         OR (route IS NOT NULL AND route NOT LIKE 'enc:v1:%')
         OR (prescribed_by IS NOT NULL AND prescribed_by NOT LIKE 'enc:v1:%')
         OR (reason IS NOT NULL AND reason NOT LIKE 'enc:v1:%')
         OR (notes IS NOT NULL AND notes NOT LIKE 'enc:v1:%')
    `;
    console.log(`\n[medication] ${rows.length} rows to encrypt`);
    for (const row of rows) {
      await sql`
        UPDATE sanotalk_medication SET
          name = ${encryptIfNeeded(row.name)},
          dosage = ${encryptIfNeeded(row.dosage)},
          frequency = ${encryptIfNeeded(row.frequency)},
          route = ${encryptIfNeeded(row.route)},
          prescribed_by = ${encryptIfNeeded(row.prescribed_by)},
          reason = ${encryptIfNeeded(row.reason)},
          notes = ${encryptIfNeeded(row.notes)},
          updated_at = now()
        WHERE id = ${row.id}
      `;
      totalUpdated++;
      console.log(`  Encrypted medication id=${row.id}`);
    }
  }

  // ── 4. sanotalk_allergy ──────────────────────────────────────────────────
  {
    const rows = await sql`
      SELECT id, name, reaction, notes
      FROM sanotalk_allergy
      WHERE name NOT LIKE 'enc:v1:%'
         OR (reaction IS NOT NULL AND reaction NOT LIKE 'enc:v1:%')
         OR (notes IS NOT NULL AND notes NOT LIKE 'enc:v1:%')
    `;
    console.log(`\n[allergy] ${rows.length} rows to encrypt`);
    for (const row of rows) {
      const nameHash = hashForIndex(row.name);
      await sql`
        UPDATE sanotalk_allergy SET
          name = ${encrypt(row.name)},
          name_hash = ${nameHash},
          reaction = ${encryptIfNeeded(row.reaction)},
          notes = ${encryptIfNeeded(row.notes)},
          updated_at = now()
        WHERE id = ${row.id}
      `;
      totalUpdated++;
      console.log(`  Encrypted allergy id=${row.id} (name_hash set)`);
    }
  }

  // ── 5. sanotalk_chronic_condition ────────────────────────────────────────
  {
    const rows = await sql`
      SELECT id, name, medications, notes
      FROM sanotalk_chronic_condition
      WHERE name NOT LIKE 'enc:v1:%'
         OR (notes IS NOT NULL AND notes NOT LIKE 'enc:v1:%')
         OR (medications IS NOT NULL AND array_length(medications, 1) > 0)
    `;

    const toUpdate = rows.filter((r) => {
      const needName = !r.name.startsWith(PREFIX);
      const needNotes = r.notes && !r.notes.startsWith(PREFIX);
      const needMeds = r.medications?.some((m: string) => !m.startsWith(PREFIX));
      return needName || needNotes || needMeds;
    });

    console.log(`\n[chronic_condition] ${toUpdate.length} rows to encrypt`);
    for (const row of toUpdate) {
      const nameHash = row.name.startsWith(PREFIX) ? undefined : hashForIndex(row.name);
      await sql`
        UPDATE sanotalk_chronic_condition SET
          name = ${encryptIfNeeded(row.name)},
          name_hash = COALESCE(${nameHash ?? null}, name_hash),
          medications = ${encryptArrayIfNeeded(row.medications)},
          notes = ${encryptIfNeeded(row.notes)},
          updated_at = now()
        WHERE id = ${row.id}
      `;
      totalUpdated++;
      console.log(`  Encrypted chronic_condition id=${row.id}`);
    }
  }

  console.log(`\nDone. Encrypted ${totalUpdated} rows total across all tables.`);
  await sql.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
