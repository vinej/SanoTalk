import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { talkSession, sessionParticipant, user } from "@sanotalk/db";
import { eq, desc, or, inArray, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { verifyAdminFromDb } from "../lib/verify-admin";

/** Returns the session (with participants+users) if the user is host or participant; throws otherwise. */
async function assertSessionAccess(
  db: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"],
  sessionId: string,
  userId: string
) {
  const session = await db.query.talkSession.findFirst({
    where: eq(talkSession.id, sessionId),
    with: { participants: { with: { user: { columns: { id: true, name: true, image: true, role: true } } } } },
  });
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
  const hasAccess =
    session.hostId === userId ||
    session.participants.some((p) => p.userId === userId);
  if (!hasAccess) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  return session;
}

export const sessionsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
    if (isAdmin) {
      // Admin sees all sessions — only session metadata fetched here
      // (transcripts, chat, recordings are in separate tables and not included)
      return ctx.db.query.talkSession.findMany({
        orderBy: [desc(talkSession.createdAt)],
        with: { participants: { with: { user: { columns: { id: true, name: true, image: true, role: true } } } } },
        limit: 200,
      });
    }
    // Single query using a subquery — user must be host OR a participant
    const participantSubquery = ctx.db
      .select({ id: sessionParticipant.sessionId })
      .from(sessionParticipant)
      .where(eq(sessionParticipant.userId, ctx.user.id));

    return ctx.db.query.talkSession.findMany({
      where: or(
        eq(talkSession.hostId, ctx.user.id),
        inArray(talkSession.id, participantSubquery)
      ),
      orderBy: [desc(talkSession.createdAt)],
      with: {
        participants: { with: { user: { columns: { id: true, name: true, image: true, role: true } } } },
      },
      limit: 200,
    });
  }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return assertSessionAccess(ctx.db, input.id, ctx.user.id);
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(120).optional(),
        language: z.enum(["en", "fr", "es", "zh", "ar", "hi"]).default("en"),
        scheduledAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const role = (ctx.user as any).role as string;
      if (role === "ia_agent") throw new TRPCError({ code: "FORBIDDEN", message: "AI agents cannot create sessions" });
      const roomName = `sanotalk-${nanoid(10)}`;
      const [created] = await ctx.db
        .insert(talkSession)
        .values({
          roomName,
          hostId: ctx.user.id,
          language: input.language,
          ...(input.title ? { title: input.title } : {}),
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        })
        .returning({ id: talkSession.id, roomName: talkSession.roomName, hostId: talkSession.hostId, title: talkSession.title, language: talkSession.language, status: talkSession.status, agentType: talkSession.agentType, scheduledAt: talkSession.scheduledAt, createdAt: talkSession.createdAt });

      return created;
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string().uuid(), title: z.string().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.query.talkSession.findFirst({
        where: eq(talkSession.id, input.id),
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      if (session.hostId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can rename a session" });

      const [updated] = await ctx.db
        .update(talkSession)
        .set({ title: input.title, updatedAt: new Date() })
        .where(eq(talkSession.id, input.id))
        .returning({ id: talkSession.id, title: talkSession.title, updatedAt: talkSession.updatedAt });
      return updated;
    }),

  start: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.query.talkSession.findFirst({
        where: eq(talkSession.id, input.id),
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      if (session.hostId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can start a session" });

      const [updated] = await ctx.db
        .update(talkSession)
        .set({ status: "active", startedAt: new Date() })
        .where(eq(talkSession.id, input.id))
        .returning({ id: talkSession.id, status: talkSession.status, startedAt: talkSession.startedAt });

      // Start voice pipelines for any AI participants already added
      const withParticipants = await ctx.db.query.talkSession.findFirst({
        where: eq(talkSession.id, input.id),
        with: { participants: true },
      });
      if (withParticipants) {
        for (const p of withParticipants.participants) {
          const isAi = await ctx.isAiAssistant(p.userId);
          if (isAi) {
            void ctx.joinAiParticipant(input.id, p.userId);
          }
        }
      }

      return updated;
    }),

  end: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.query.talkSession.findFirst({
        where: eq(talkSession.id, input.id),
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      if (session.hostId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can end a session" });

      // Disconnect all AI participants from the session
      void ctx.removeAllAiParticipants(input.id);

      const [updated] = await ctx.db
        .update(talkSession)
        .set({ status: "completed", endedAt: new Date() })
        .where(eq(talkSession.id, input.id))
        .returning({ id: talkSession.id, status: talkSession.status, endedAt: talkSession.endedAt });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.query.talkSession.findFirst({
        where: eq(talkSession.id, input.id),
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      if (session.hostId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can delete a session" });

      await ctx.db.delete(talkSession).where(eq(talkSession.id, input.id));
    }),

  addParticipant: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), userId: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.query.talkSession.findFirst({
        where: eq(talkSession.id, input.sessionId),
        with: { participants: true },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      if (session.hostId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can add participants" });

      const alreadyAdded = session.participants.some((p) => p.userId === input.userId);
      if (alreadyAdded) return;

      // Verify the target user actually exists (uniform error to prevent enumeration)
      const targetUser = await ctx.db.select({ id: user.id }).from(user).where(eq(user.id, input.userId)).limit(1);
      if (targetUser.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Could not add participant" });

      await ctx.db.insert(sessionParticipant).values({
        sessionId: input.sessionId,
        userId: input.userId,
      });

      // If the participant is an AI assistant and session is active, start voice pipeline
      if (session.status === "active") {
        const isAi = await ctx.isAiAssistant(input.userId);
        if (isAi) {
          void ctx.joinAiParticipant(input.sessionId, input.userId);
        }
      }
    }),

  removeParticipant: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), userId: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.query.talkSession.findFirst({
        where: eq(talkSession.id, input.sessionId),
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      if (session.hostId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can remove participants" });

      // If the participant is an AI assistant, stop its voice pipeline
      const isAi = await ctx.isAiAssistant(input.userId);
      if (isAi) {
        void ctx.removeAiParticipant(input.sessionId, input.userId);
      }

      await ctx.db
        .delete(sessionParticipant)
        .where(
          and(
            eq(sessionParticipant.sessionId, input.sessionId),
            eq(sessionParticipant.userId, input.userId)
          )
        );
    }),

  setAgentType: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      agentType: z.enum(["health", "companion", "pharmacist"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.query.talkSession.findFirst({
        where: eq(talkSession.id, input.sessionId),
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      if (session.hostId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the host can set the agent type" });
      await ctx.db.update(talkSession)
        .set({ agentType: input.agentType })
        .where(eq(talkSession.id, input.sessionId));
      return { ok: true };
    }),
});
