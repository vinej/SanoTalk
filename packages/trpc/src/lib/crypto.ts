import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

// ── Key rotation support ────────────────────────────────────────────────────
// Current key version used for NEW encryptions.
// Decryption reads the version from the prefix and selects the right key.
// To rotate: set ENCRYPTION_KEY_V2 in env, bump CURRENT_KEY_VERSION to 2,
// then run a migration script that re-encrypts all enc:v1: values.
const CURRENT_KEY_VERSION = 1;

const keyCache = new Map<number, Buffer>();

function getKeyForVersion(version: number): Buffer {
  const cached = keyCache.get(version);
  if (cached) return cached;

  // v1 uses ENCRYPTION_KEY, v2+ use ENCRYPTION_KEY_V<n>
  const envVar = version === 1 ? "ENCRYPTION_KEY" : `ENCRYPTION_KEY_V${version}`;
  const hex = process.env[envVar];
  if (!hex || hex.length !== 64) {
    throw new Error(`${envVar} must be a 64-char hex string (32 bytes)`);
  }
  const key = Buffer.from(hex, "hex");
  keyCache.set(version, key);
  return key;
}

function getKey(): Buffer {
  return getKeyForVersion(CURRENT_KEY_VERSION);
}

/** Keys that must be encrypted at rest. */
export const ENCRYPTED_KEYS = new Set<string>([]);

/** Encrypt a plaintext string with AES-256-GCM. Returns a prefixed string. */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v${CURRENT_KEY_VERSION}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Encrypt text content (chat messages, transcripts, SOAP notes) at rest.
 * Returns the encrypted string. Null/undefined inputs pass through.
 */
export function encryptContent(text: string | null | undefined): string | null {
  if (!text) return text as null;
  return encrypt(text);
}

/**
 * Decrypt text content. Handles pre-migration plaintext gracefully.
 * Null/undefined inputs pass through.
 */
export function decryptContent(text: string | null | undefined): string | null {
  if (!text) return text as null;
  return decrypt(text);
}

/** Encrypt each element of a text array individually. Null/undefined arrays pass through. */
export function encryptArray(arr: string[] | null | undefined): string[] | null {
  if (!arr) return null;
  return arr.map((el) => encrypt(el));
}

/** Decrypt each element of a text array. Handles pre-migration plaintext. Null/undefined arrays pass through. */
export function decryptArray(arr: string[] | null | undefined): string[] | null {
  if (!arr) return null;
  return arr.map((el) => decrypt(el));
}

/** Encrypt a numeric value as a string. Null/undefined inputs pass through. */
export function encryptNumeric(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return encrypt(String(value));
}

/** Decrypt an encrypted string back to a number. Null/undefined inputs pass through. */
export function decryptNumeric(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const decrypted = decrypt(text);
  const num = Number(decrypted);
  return Number.isNaN(num) ? null : num;
}

/** Deterministic SHA-256 hash for unique index lookup (case-insensitive, trimmed). */
export function hashForIndex(text: string): string {
  return createHash("sha256").update(text.toLowerCase().trim()).digest("hex");
}

/** Decrypt a value. Returns plaintext. Handles unencrypted values gracefully (migration). */
export function decrypt(value: string): string {
  // Parse versioned prefix: enc:v<N>:iv:tag:data
  const versionMatch = value.match(/^enc:v(\d+):/);
  if (!versionMatch) return value; // plaintext (pre-migration data)

  const version = Number(versionMatch[1]);
  const key = getKeyForVersion(version);
  const rest = value.slice(versionMatch[0].length);
  const [ivHex, tagHex, dataHex] = rest.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Malformed encrypted value");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data).toString("utf8") + decipher.final("utf8");
}
