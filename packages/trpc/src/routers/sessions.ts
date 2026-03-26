import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { talkSession, sessionParticipant } from "@sanotalk/db";
import { eq, desc, or, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";

/** Returns the session (with participants+users) if the user is host or participant; throws otherwise. */
async function assertSessionAccess(
  db: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"],
  sessionId: string,
  userId: string
) {
  const session = await db.query.talkSession.findFirst({
    where: eq(talkSession.id, sessionId),
    with: { participants: { with: { user: true } } },
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
        participants: { with: { user: true } },
      },
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
        language: z.string().default("en"),
        scheduledAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
        .returning();

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
        .returning();
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
        .returning();
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

      const [updated] = await ctx.db
        .update(talkSession)
        .set({ status: "completed", endedAt: new Date() })
        .where(eq(talkSession.id, input.id))
        .returning();
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
});
