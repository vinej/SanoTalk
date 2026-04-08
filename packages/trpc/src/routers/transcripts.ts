import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { transcript, transcriptSummary, talkSession } from "@sanotalk/db";
import { eq, desc } from "drizzle-orm";
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
        orderBy: [desc(transcript.createdAt)],
        with: { speaker: { columns: { id: true, name: true, image: true, role: true } } },
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
          speakerId: ctx.user.id,
          speakerLabel: input.speakerLabel,
          content: input.content,
          confidence: input.confidence,
          startMs: input.startMs,
          endMs: input.endMs,
        })
        .returning({ id: transcript.id, sessionId: transcript.sessionId, content: transcript.content, createdAt: transcript.createdAt });
      return saved;
    }),
});
