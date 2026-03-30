import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { talkSession } from "@sanotalk/db";
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
        contentType: z.string().max(100),
        sessionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx.db, input.sessionId, ctx.user.id);
      const client = getMinioClient();
      const bucket = process.env.MINIO_BUCKET ?? "sanotalk";
      const safeFilename = sanitizeFilename(input.filename);
      const key = `sessions/${input.sessionId}/${Date.now()}-${safeFilename}`;

      const presignedUrl = await client.presignedPutObject(bucket, key, 3600);
      return { presignedUrl, key, bucket };
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ key: z.string().max(500) }))
    .query(async ({ ctx, input }) => {
      const sessionId = extractSessionId(input.key);
      if (!sessionId) throw new TRPCError({ code: "FORBIDDEN", message: "Invalid file key" });
      await assertSessionAccess(ctx.db, sessionId, ctx.user.id);

      const client = getMinioClient();
      const bucket = process.env.MINIO_BUCKET ?? "sanotalk";
      const url = await client.presignedGetObject(bucket, input.key, 3600);
      return { url };
    }),
});
