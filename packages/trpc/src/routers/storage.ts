import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp.js";
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

export const storageRouter = createTRPCRouter({
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        sessionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = getMinioClient();
      const bucket = process.env.MINIO_BUCKET ?? "sanotalk";
      const key = `sessions/${input.sessionId}/${Date.now()}-${input.filename}`;

      const presignedUrl = await client.presignedPutObject(bucket, key, 3600);
      return { presignedUrl, key, bucket };
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ key: z.string(), bucket: z.string().optional() }))
    .query(async ({ input }) => {
      const client = getMinioClient();
      const bucket = input.bucket ?? process.env.MINIO_BUCKET ?? "sanotalk";
      const url = await client.presignedGetObject(bucket, input.key, 3600);
      return { url };
    }),
});
