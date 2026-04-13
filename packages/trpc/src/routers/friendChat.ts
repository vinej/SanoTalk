import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { friendChatRoom, friendChatParticipant, userFriend, user } from "@sanotalk/db";
import { eq, and, desc, gte, inArray, isNull, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { AccessToken, RoomServiceClient, DataPacket_Kind } from "livekit-server-sdk";
import { nanoid } from "nanoid";

const MAX_ROOMS_PER_HOUR = 10;
const MAX_MESSAGE_LENGTH = 2000;
const MESSAGE_RATE_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 20;

/** Per-user sliding-window rate limit for chat messages. Single-instance only. */
const messageTimestampsByUser = new Map<string, number[]>();

function checkMessageRate(userId: string): boolean {
  const now = Date.now();
  const windowStart = now - MESSAGE_RATE_WINDOW_MS;
  const prev = messageTimestampsByUser.get(userId) ?? [];
  const recent = prev.filter((ts) => ts > windowStart);
  if (recent.length >= MAX_MESSAGES_PER_WINDOW) return false;
  recent.push(now);
  messageTimestampsByUser.set(userId, recent);
  return true;
}

/** LiveKit server HTTP URL derived from LIVEKIT_URL (ws:// → http://, wss:// → https://). */
function getLivekitHttpUrl(): string {
  const raw = process.env.LIVEKIT_URL ?? "";
  if (raw.startsWith("wss://")) return "https://" + raw.slice("wss://".length);
  if (raw.startsWith("ws://")) return "http://" + raw.slice("ws://".length);
  return raw;
}

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
      friendIds: z.array(z.string().min(1)).min(1).max(20),
      name: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Cap rooms created per hour to prevent toast-spam / harassment
      const since = new Date(Date.now() - 60 * 60_000);
      const [{ value: recentCount } = { value: 0 }] = await ctx.db
        .select({ value: count() })
        .from(friendChatRoom)
        .where(and(
          eq(friendChatRoom.createdById, ctx.user.id),
          gte(friendChatRoom.createdAt, since),
        ));
      if (recentCount >= MAX_ROOMS_PER_HOUR) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many chat rooms created. Try again later." });
      }

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
              with: {
                user: {
                  columns: { id: true, name: true, image: true, deletionScheduledFor: true },
                },
              },
            },
          },
        },
      },
    });

    // Strip soft-deleted users from the participants roster so the UI never
    // shows "pending-deletion" accounts. Drop the deletion marker before
    // returning to avoid leaking the schedule to the client.
    return participations
      .map((p) => ({
        ...p.room,
        participants: p.room.participants
          .filter((part) => !part.user || part.user.deletionScheduledFor == null)
          .map(({ user: u, ...rest }) => ({
            ...rest,
            user: u ? { id: u.id, name: u.name, image: u.image } : u,
          })),
      }))
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

  /** Add a friend to an existing chat room. Creator-only to keep the roster
   *  bounded to the creator's original invitees. */
  addParticipant: protectedProcedure
    .input(z.object({
      roomId: z.string().uuid(),
      friendId: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only the room creator may invite additional participants. This prevents
      // member chaining (invitee → invites own friend → room leaks beyond the
      // creator's intended audience).
      const room = await ctx.db.query.friendChatRoom.findFirst({
        where: eq(friendChatRoom.id, input.roomId),
        columns: { id: true, createdById: true },
      });
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (room.createdById !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the room creator can invite others" });
      }

      // Verify the invitee is a friend of the creator
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

      // canPublishData is FALSE: clients cannot publish directly on the data
      // channel. All chat messages go through the `sendMessage` mutation so the
      // server can validate membership, rate-limit, and sanitize before relaying
      // via RoomServiceClient.sendData. Subscribe must be TRUE so clients
      // receive the server-relayed messages.
      at.addGrant({
        roomJoin: true,
        room: room.roomName,
        canPublish: false,
        canSubscribe: true,
        canPublishData: false,
      });

      return {
        token: await at.toJwt(),
        serverUrl: process.env.LIVEKIT_URL!,
        roomName: room.roomName,
      };
    }),

  /** Send a chat message to a friend chat room. The server validates the
   *  caller's membership, rate-limits, sanitizes, then relays the payload to
   *  every participant via the LiveKit data channel. Clients never publish
   *  data directly (see canPublishData=false in getToken). */
  sendMessage: protectedProcedure
    .input(z.object({
      roomId: z.string().uuid(),
      message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
    }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const httpUrl = getLivekitHttpUrl();
      if (!apiKey || !apiSecret || !httpUrl) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LiveKit credentials not configured" });
      }

      // Membership check — mirrors getRoom/getToken policy.
      const room = await ctx.db.query.friendChatRoom.findFirst({
        where: eq(friendChatRoom.id, input.roomId),
        columns: { id: true, roomName: true },
        with: { participants: { columns: { userId: true } } },
      });
      if (!room) throw new TRPCError({ code: "NOT_FOUND" });
      if (!room.participants.some((p) => p.userId === ctx.user.id)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (!checkMessageRate(ctx.user.id)) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Slow down." });
      }

      // Strip control chars (except newline/tab) to neutralize hidden payload
      // tricks; trim and re-check non-empty after sanitizing.
      const sanitized = input.message
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
        .trim();
      if (!sanitized) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Empty message" });
      }

      // Fetch sender's avatar once so receivers render the right image without
      // a round-trip per message.
      const senderRecord = await ctx.db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
        columns: { image: true },
      });
      const senderAvatar = resolveImageUrl(senderRecord?.image, ctx.user.id);

      const payload = {
        type: "chat" as const,
        id: nanoid(12),
        senderId: ctx.user.id,
        senderName: ctx.user.name,
        senderAvatar,
        message: sanitized,
        timestamp: Date.now(),
      };
      const bytes = new TextEncoder().encode(JSON.stringify(payload));

      const svc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
      try {
        await svc.sendData(room.roomName, bytes, DataPacket_Kind.RELIABLE, { topic: "chat" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Relay failed: ${msg}` });
      }

      // Bump activity so list ordering stays fresh; not blocking the relay.
      await ctx.db
        .update(friendChatRoom)
        .set({ lastActivityAt: new Date() })
        .where(eq(friendChatRoom.id, input.roomId));

      return { id: payload.id, timestamp: payload.timestamp };
    }),
});
