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
      const presignedUrl = await client.presignedPutObject(bucket, key, 3600);
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

      // Validate magic bytes match declared content type
      const magicBytes: Record<string, number[]> = {
        "image/jpeg": [0xFF, 0xD8, 0xFF],
        "image/png": [0x89, 0x50, 0x4E, 0x47],
        "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF header
      };
      const expected = magicBytes[input.contentType];
      if (!expected || buffer.length < expected.length || !expected.every((b, i) => buffer[i] === b)) {
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
