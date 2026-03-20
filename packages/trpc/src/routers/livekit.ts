import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc.js";
import { AccessToken } from "livekit-server-sdk";

export const livekitRouter = createTRPCRouter({
  getToken: protectedProcedure
    .input(
      z.object({
        roomName: z.string(),
        participantName: z.string().optional(),
        canPublish: z.boolean().default(true),
        canSubscribe: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;

      if (!apiKey || !apiSecret) {
        throw new Error("LiveKit credentials not configured");
      }

      const at = new AccessToken(apiKey, apiSecret, {
        identity: ctx.user.id,
        name: input.participantName ?? ctx.user.name,
        ttl: "2h",
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
