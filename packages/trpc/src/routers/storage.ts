import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { talkSession, user } from "@sanotalk/db";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as Minio from "minio";

let _minioClient: Minio.Client | null = null;
function getMinioClient(): Minio.Client {
  if (!_minioClient) {
    _minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT!,
      port: parseInt(process.env.MINIO_PORT ?? "9000"),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });
  }
  return _minioClient;
}

/** Parse sessionId from a key of the form "sessions/{sessionId}/..." */
function extractSessionId(key: string): string | null {
  const match = /^sessions\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i.exec(key);
  return match?.[1] ?? null;
}

/** Throws FORBIDDEN if the user is not the host or a participant of the session. */
async function assertSessionAccess(
  db: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"],
  sessionId: string,
  userId: string
) {
  const session = await db.query.talkSession.findFirst({
    where: eq(talkSession.id, sessionId),
    with: { participants: true },
  });
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
  const hasAccess =
    session.hostId === userId ||
    session.participants.some((p) => p.userId === userId);
  if (!hasAccess) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
}

/** Safe filename: strip path traversal and limit length */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

export const storageRouter = createTRPCRouter({
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string().max(200),
        contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf", "audio/webm", "audio/ogg"]),
        sessionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx.db, input.sessionId, ctx.user.id);
      const client = getMinioClient();
      const bucket = process.env.MINIO_BUCKET ?? "sanotalk";
      const safeFilename = sanitizeFilename(input.filename);
      const key = `sessions/${input.sessionId}/${Date.now()}-${safeFilename}`;

      // Note: presignedPutObject doesn't enforce Content-Type server-side.
      // Download endpoint mitigates XSS by forcing Content-Disposition: attachment.
      // MinIO should not be directly accessible from the internet.
      // 10-minute TTL: long enough for a legitimate client+network round-trip,
      // short enough to limit the blast radius of a leaked URL.
      const presignedUrl = await client.presignedPutObject(bucket, key, 600);
      return { presignedUrl, key, bucket, contentType: input.contentType };
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ key: z.string().max(500) }))
    .query(async ({ ctx, input }) => {
      const sessionId = extractSessionId(input.key);
      if (!sessionId) throw new TRPCError({ code: "FORBIDDEN", message: "Invalid file key" });
      await assertSessionAccess(ctx.db, sessionId, ctx.user.id);

      const client = getMinioClient();
      const bucket = process.env.MINIO_BUCKET ?? "sanotalk";
      // Force downloads as attachments to prevent browser-rendered XSS via uploaded HTML
      const url = await client.presignedGetObject(bucket, input.key, 3600, {
        "response-content-disposition": "attachment",
      });
      return { url };
    }),

  uploadAvatar: protectedProcedure
    .input(
      z.object({
        base64: z.string().max(7_500_000), // ~5MB file after base64 encoding
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = getMinioClient();
      const bucket = process.env.MINIO_BUCKET ?? "sanotalk";
      const ext = input.contentType === "image/jpeg" ? "jpg" : input.contentType === "image/png" ? "png" : "webp";
      const key = `avatars/${ctx.user.id}-${Date.now()}.${ext}`;

      const buffer = Buffer.from(input.base64, "base64");

      // Validate magic bytes match declared content type.
      // For JPEG we also require the EOI marker (FF D9) at the tail so a
      // truncated/appended payload is rejected. For WebP we verify "WEBP"
      // appears at bytes 8-11 (the RIFF header alone matches AVI/WAV/etc).
      // For PNG we verify the IEND chunk near the tail.
      const matches = (bytes: number[], at: number): boolean =>
        buffer.length >= at + bytes.length && bytes.every((b, i) => buffer[at + i] === b);
      let ok = false;
      if (input.contentType === "image/jpeg") {
        ok = matches([0xFF, 0xD8, 0xFF], 0)
          && buffer.length >= 4
          && buffer[buffer.length - 2] === 0xFF
          && buffer[buffer.length - 1] === 0xD9;
      } else if (input.contentType === "image/png") {
        ok = matches([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0)
          // IEND chunk: "IEND" + CRC (4 bytes) at tail
          && matches([0x49, 0x45, 0x4E, 0x44], buffer.length - 8);
      } else if (input.contentType === "image/webp") {
        ok = matches([0x52, 0x49, 0x46, 0x46], 0)
          && matches([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
      }
      if (!ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File content does not match declared type" });
      }

      await client.putObject(bucket, key, buffer, buffer.length, {
        "Content-Type": input.contentType,
      });

      // Update user image field
      await ctx.db
        .update(user)
        .set({ image: key })
        .where(eq(user.id, ctx.user.id));

      return { key };
    }),
});
