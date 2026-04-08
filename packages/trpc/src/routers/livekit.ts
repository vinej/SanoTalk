import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { talkSession, user } from "@sanotalk/db";
import { eq } from "drizzle-orm";
import { AccessToken } from "livekit-server-sdk";
import { TRPCError } from "@trpc/server";

/** Resolve an image value to a URL suitable for embedding in participant metadata. */
function resolveImageUrl(image: string | null | undefined, userId: string): string | null {
  if (!image) return null;
  // External URLs (DiceBear, etc.) — use directly
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  // MinIO key — use the server-side avatar proxy with cache buster
  return `/api/avatar/${userId}?v=${encodeURIComponent(image)}`;
}

export const livekitRouter = createTRPCRouter({
  getToken: protectedProcedure
    .input(
      z.object({
        roomName: z.string().min(1).max(100).regex(/^sanotalk-[\w-]+$/),
        participantName: z.string().optional(),
        canPublish: z.boolean().default(true),
        canSubscribe: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;

      if (!apiKey || !apiSecret) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LiveKit credentials not configured" });
      }

      // Verify the room belongs to a session the user can access
      const session = await ctx.db.query.talkSession.findFirst({
        where: eq(talkSession.roomName, input.roomName),
        with: { participants: true },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
      const hasAccess =
        session.hostId === ctx.user.id ||
        session.participants.some((p) => p.userId === ctx.user.id);
      if (!hasAccess) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });

      // Fetch user's avatar for participant metadata
      const userRecord = await ctx.db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
        columns: { image: true },
      });
      const avatarUrl = resolveImageUrl(userRecord?.image, ctx.user.id);
      const metadata = JSON.stringify({ avatarUrl });

      const at = new AccessToken(apiKey, apiSecret, {
        identity: ctx.user.id,
        name: input.participantName ?? ctx.user.name,
        metadata,
        ttl: "1h",
      });

      at.addGrant({
        roomJoin: true,
        room: input.roomName,
        canPublish: input.canPublish,
        canSubscribe: input.canSubscribe,
        canPublishData: true,
      });

      return {
        token: await at.toJwt(),
        serverUrl: process.env.LIVEKIT_URL!,
      };
    }),
});
