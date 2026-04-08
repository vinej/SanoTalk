import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PREFIX = "enc:v1:";

/** Keys that must be encrypted at rest. */
export const ENCRYPTED_KEYS = new Set(["ramq_number", "ramq_expiry"]);

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

/** Encrypt a plaintext string with AES-256-GCM. Returns a prefixed string. */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt a value. Returns plaintext. Handles unencrypted values gracefully (migration). */
export function decrypt(value: string): string {
  if (!value.startsWith(PREFIX)) return value; // already plaintext (pre-migration data)
  const key = getKey();
  const rest = value.slice(PREFIX.length);
  const [ivHex, tagHex, dataHex] = rest.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Malformed encrypted value");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data).toString("utf8") + decipher.final("utf8");
}
