import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { transcript, transcriptSummary, talkSession } from "@sanotalk/db";
import { eq, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

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

export const transcriptsRouter = createTRPCRouter({
  bySession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertSessionAccess(ctx.db, input.sessionId, ctx.user.id);
      return ctx.db.query.transcript.findMany({
        where: eq(transcript.sessionId, input.sessionId),
        orderBy: [asc(transcript.startMs)],
        with: { speaker: true },
      });
    }),

  summaryBySession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertSessionAccess(ctx.db, input.sessionId, ctx.user.id);
      return (await ctx.db.query.transcriptSummary.findFirst({
        where: eq(transcriptSummary.sessionId, input.sessionId),
      })) ?? null;
    }),

  save: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        speakerId: z.string().optional(),
        speakerLabel: z.string().optional(),
        content: z.string().max(10000),
        confidence: z.number().optional(),
        startMs: z.number().optional(),
        endMs: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx.db, input.sessionId, ctx.user.id);
      const [saved] = await ctx.db
        .insert(transcript)
        .values({
          sessionId: input.sessionId,
          content: input.content,
        })
        .returning();
      return saved;
    }),
});
