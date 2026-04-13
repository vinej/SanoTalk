import type { Request, Response } from "express";
import crypto from "crypto";
import { db } from "@sanotalk/db";
import { wearableConnection, vitalSign, user } from "@sanotalk/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../logger";
import { mapTerraPayload } from "./mapper";

interface TerraEnvelope {
  type: string; // "auth" | "deauth" | "user_reauth" | "body" | "daily" | "activity" | ...
  user?: {
    user_id?: string;
    reference_id?: string;
    provider?: string;
    scopes?: string;
  };
  status?: string;
  // body / daily / activity payloads include `data: [...]`
  data?: unknown[];
}

/**
 * Verify Terra HMAC signature.
 *
 * Terra sends `terra-signature: t=<unix_seconds>,v1=<hex_hmac>`.
 * Signature input is `${t}.${rawBody}` HMAC-SHA256-ed with TERRA_WEBHOOK_SECRET.
 */
function verifySignature(rawBody: Buffer, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.trim().split("=")).filter((kv) => kv.length === 2)
  ) as Record<string, string>;
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  // Reject signatures older than 5 minutes (replay protection).
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody.toString("utf8")}`)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function terraWebhookHandler(req: Request, res: Response): Promise<void> {
  const secret = process.env.TERRA_WEBHOOK_SECRET;
  if (!secret) {
    logger.error("TERRA_WEBHOOK_SECRET not configured");
    res.status(500).json({ error: "not configured" });
    return;
  }

  // express.raw gives us a Buffer; we must verify before JSON.parse-ing.
  const rawBody = req.body as Buffer;
  if (!Buffer.isBuffer(rawBody)) {
    logger.warn("Terra webhook: missing raw body — verify express.raw middleware order");
    res.status(400).json({ error: "bad body" });
    return;
  }

  const sigHeader = req.header("terra-signature") ?? req.header("Terra-Signature");
  if (!verifySignature(rawBody, sigHeader, secret)) {
    logger.warn({ sig: sigHeader?.slice(0, 30) }, "Terra webhook: signature verification failed");
    res.status(401).json({ error: "invalid signature" });
    return;
  }

  let envelope: TerraEnvelope;
  try {
    envelope = JSON.parse(rawBody.toString("utf8")) as TerraEnvelope;
  } catch (err) {
    logger.warn({ err }, "Terra webhook: invalid JSON");
    res.status(400).json({ error: "invalid json" });
    return;
  }

  try {
    await dispatch(envelope);
    res.status(200).json({ ok: true });
  } catch (err) {
    // Returning 5xx tells Terra to retry — only do that on transient errors.
    logger.error({ err, type: envelope.type }, "Terra webhook handler failed");
    res.status(500).json({ error: "handler error" });
  }
}

async function dispatch(envelope: TerraEnvelope): Promise<void> {
  const { type } = envelope;

  switch (type) {
    case "auth":
      await handleAuth(envelope);
      return;
    case "deauth":
      await handleDeauth(envelope);
      return;
    case "user_reauth":
      await handleReauth(envelope);
      return;
    case "body":
    case "daily":
    case "activity":
      await handleVitalsPayload(envelope);
      return;
    default:
      logger.info({ type }, "Terra webhook: unhandled event type");
      return;
  }
}

async function handleAuth(envelope: TerraEnvelope): Promise<void> {
  const refId = envelope.user?.reference_id;
  const terraUserId = envelope.user?.user_id;
  const provider = envelope.user?.provider;
  if (!refId || !terraUserId || !provider) {
    logger.warn({ envelope }, "Terra auth event missing required fields");
    return;
  }

  // Verify the reference_id resolves to a real SanoTalk user before insert.
  const u = await db.query.user.findFirst({ where: eq(user.id, refId), columns: { id: true } });
  if (!u) {
    logger.warn({ refId, terraUserId }, "Terra auth event references unknown user — refusing insert");
    return;
  }

  await db
    .insert(wearableConnection)
    .values({
      userId: refId,
      provider: provider.toUpperCase(),
      terraUserId,
      scopes: envelope.user?.scopes ?? null,
      status: "active",
    })
    .onConflictDoUpdate({
      target: wearableConnection.terraUserId,
      set: {
        userId: refId,
        provider: provider.toUpperCase(),
        scopes: envelope.user?.scopes ?? null,
        status: "active",
        updatedAt: new Date(),
      },
    });

  logger.info({ userId: refId, provider }, "Terra connection authorized");
}

async function handleDeauth(envelope: TerraEnvelope): Promise<void> {
  const terraUserId = envelope.user?.user_id;
  if (!terraUserId) return;
  await db
    .update(wearableConnection)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(wearableConnection.terraUserId, terraUserId));
  logger.info({ terraUserId }, "Terra connection revoked");
}

async function handleReauth(envelope: TerraEnvelope): Promise<void> {
  const terraUserId = envelope.user?.user_id;
  if (!terraUserId) return;
  await db
    .update(wearableConnection)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(wearableConnection.terraUserId, terraUserId));
  logger.info({ terraUserId }, "Terra connection re-authorized");
}

async function handleVitalsPayload(envelope: TerraEnvelope): Promise<void> {
  const terraUserId = envelope.user?.user_id;
  if (!terraUserId) {
    logger.warn({ type: envelope.type }, "Terra payload missing user_id");
    return;
  }
  const conn = await db.query.wearableConnection.findFirst({
    where: eq(wearableConnection.terraUserId, terraUserId),
    columns: { userId: true, status: true, id: true },
  });
  if (!conn) {
    logger.warn({ terraUserId }, "Terra payload for unknown connection — dropping");
    return;
  }

  const rows = mapTerraPayload(envelope.type, envelope, conn.userId);
  if (rows.length === 0) {
    logger.info({ type: envelope.type, terraUserId }, "Terra payload mapped to 0 rows");
  } else {
    // Insert with idempotent dedupe on (userId, source, externalId).
    await db.insert(vitalSign).values(rows).onConflictDoNothing();
    logger.info({ type: envelope.type, count: rows.length, userId: conn.userId }, "Terra vitals upserted");
  }

  await db
    .update(wearableConnection)
    .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(wearableConnection.id, conn.id));
}

// Suppress unused import warning if a future dispatcher branch needs sql.
void sql;
