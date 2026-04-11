import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { friendChatRoom, friendChatParticipant, userFriend, user } from "@sanotalk/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { AccessToken } from "livekit-server-sdk";
import { nanoid } from "nanoid";

/** Resolve an image value to a URL suitable for participant metadata. */
function resolveImageUrl(image: string | null | undefined, userId: string): string | null {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return `/api/avatar/${userId}?v=${encodeURIComponent(image)}`;
}

export const friendChatRouter = createTRPCRouter({
  /** Create a new chat room and add selected friends as participants. */
  create: protectedProcedure
    .input(z.object({
      friendIds: z.array(z.string().uuid()).min(1).max(20),
      name: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify all friendIds are actual friends
      const friendships = await ctx.db
        .select({ friendId: userFriend.friendId })
        .from(userFriend)
        .where(and(
          eq(userFriend.userId, ctx.user.id),
          inArray(userFriend.friendId, input.friendIds),
        ));
      const validFriendIds = new Set(friendships.map((f) => f.friendId));
      const invalid = input.friendIds.filter((id) => !validFriendIds.has(id));
      if (invalid.length > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Some users are not your friends" });
      }

      const roomName = `sanotalk-fc-${nanoid(10)}`;

      const [room] = await ctx.db
        .insert(friendChatRoom)
        .values({
          roomName,
          createdById: ctx.user.id,
          name: input.name ?? null,
        })
        .returning();

      // Add creator + all friends as participants
      const allParticipantIds = [ctx.user.id, ...input.friendIds];
      await ctx.db.insert(friendChatParticipant).values(
        allParticipantIds.map((userId) => ({ roomId: room!.id, userId })),
      );

      return room;
    }),

  /** List all chat rooms the current user participates in. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const participations = await ctx.db.query.friendChatParticipant.findMany({
      where: eq(friendChatParticipant.userId, ctx.user.id),
      with: {
        room: {
          with: {
            participants: {
              with: { user: { columns: { id: true, name: true, image: true } } },
            },
          },
        },
      },
    });

    return participations
      .map((p) => p.room)
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
  }),

  /** Get a single room with participants. */
  getRoom: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const room = await ctx.db.query.friendChatRoom.findFirst({
        where: eq(friendChatRoom.id, input.roomId),
        with: {
          participants: {
            with: { user: { columns: { id: true, name: true, image: true } } },
          },
        },
      });
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });

      const isMember = room.participants.some((p) => p.userId === ctx.user.id);
      if (!isMember) throw new TRPCError({ code: "FORBIDDEN" });

      return room;
    }),

  /** Add a friend to an existing chat room. */
  addParticipant: protectedProcedure
    .input(z.object({
      roomId: z.string().uuid(),
      friendId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify caller is in the room
      const membership = await ctx.db.query.friendChatParticipant.findFirst({
        where: and(
          eq(friendChatParticipant.roomId, input.roomId),
          eq(friendChatParticipant.userId, ctx.user.id),
        ),
      });
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

      // Verify the invitee is a friend
      const friendship = await ctx.db.query.userFriend.findFirst({
        where: and(
          eq(userFriend.userId, ctx.user.id),
          eq(userFriend.friendId, input.friendId),
        ),
      });
      if (!friendship) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "User is not your friend" });
      }

      // Add (ignore if already a participant)
      await ctx.db
        .insert(friendChatParticipant)
        .values({ roomId: input.roomId, userId: input.friendId })
        .onConflictDoNothing();

      return { added: true };
    }),

  /** Leave a chat room. Deletes the room if no participants remain. */
  leave: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db
        .delete(friendChatParticipant)
        .where(and(
          eq(friendChatParticipant.roomId, input.roomId),
          eq(friendChatParticipant.userId, ctx.user.id),
        ))
        .returning({ id: friendChatParticipant.id });
      if (deleted.length === 0) throw new TRPCError({ code: "NOT_FOUND" });

      // If no participants remain, delete the room
      const remaining = await ctx.db.query.friendChatParticipant.findFirst({
        where: eq(friendChatParticipant.roomId, input.roomId),
      });
      if (!remaining) {
        await ctx.db.delete(friendChatRoom).where(eq(friendChatRoom.id, input.roomId));
      }

      return { left: true };
    }),

  /** Update room activity timestamp (called when sending messages). */
  heartbeat: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify caller is a participant before updating
      const membership = await ctx.db.query.friendChatParticipant.findFirst({
        where: and(
          eq(friendChatParticipant.roomId, input.roomId),
          eq(friendChatParticipant.userId, ctx.user.id),
        ),
      });
      if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
      await ctx.db
        .update(friendChatRoom)
        .set({ lastActivityAt: new Date() })
        .where(eq(friendChatRoom.id, input.roomId));
      return { ok: true };
    }),

  /** Generate a LiveKit token for a friend chat room (text-only, no audio/video). */
  getToken: protectedProcedure
    .input(z.object({ roomId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      if (!apiKey || !apiSecret) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LiveKit credentials not configured" });
      }

      // Verify membership and get room name
      const room = await ctx.db.query.friendChatRoom.findFirst({
        where: eq(friendChatRoom.id, input.roomId),
        with: { participants: true },
      });
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });

      const isMember = room.participants.some((p) => p.userId === ctx.user.id);
      if (!isMember) throw new TRPCError({ code: "FORBIDDEN" });

      // Fetch avatar for metadata
      const userRecord = await ctx.db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
        columns: { image: true },
      });
      const avatarUrl = resolveImageUrl(userRecord?.image, ctx.user.id);
      const metadata = JSON.stringify({ avatarUrl });

      const at = new AccessToken(apiKey, apiSecret, {
        identity: ctx.user.id,
        name: ctx.user.name,
        metadata,
        ttl: "2h",
      });

      at.addGrant({
        roomJoin: true,
        room: room.roomName,
        canPublish: false,
        canSubscribe: false,
        canPublishData: true,
      });

      return {
        token: await at.toJwt(),
        serverUrl: process.env.LIVEKIT_URL!,
        roomName: room.roomName,
      };
    }),
});
