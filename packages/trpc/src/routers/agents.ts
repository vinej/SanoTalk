import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { agentRun, talkSession, chatMessage, transcript } from "@sanotalk/db";
import { eq, asc, desc } from "drizzle-orm";
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

export const agentsRouter = createTRPCRouter({
  generateSummary: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx.db, input.sessionId, ctx.user.id);
      const [run] = await ctx.db
        .insert(agentRun)
        .values({
          agentName: "summaryAgent",
          input: { sessionId: input.sessionId },
        })
        .returning();
      if (run) ctx.triggerAgentRun(run.id);
      return run;
    }),

  runStatus: protectedProcedure
    .input(z.object({ runId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.agentRun.findFirst({
        where: eq(agentRun.id, input.runId),
      });
    }),

  chatHistory: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertSessionAccess(ctx.db, input.sessionId, ctx.user.id);
      return ctx.db.query.chatMessage.findMany({
        where: eq(chatMessage.sessionId, input.sessionId),
        orderBy: [asc(chatMessage.createdAt)],
      });
    }),

  sendChatMessage: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      message: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx.db, input.sessionId, ctx.user.id);

      // Fetch last 20 chat messages as conversation history
      const pastMessages = await ctx.db.query.chatMessage.findMany({
        where: eq(chatMessage.sessionId, input.sessionId),
        orderBy: [asc(chatMessage.createdAt)],
        limit: 20,
      });

      // Fetch last 5 transcript entries for session context
      const recentTranscripts = await ctx.db.query.transcript.findMany({
        where: eq(transcript.sessionId, input.sessionId),
        orderBy: [desc(transcript.startMs)],
        limit: 5,
      });

      // Build history array, prepending transcript context if available
      const history: Array<{ role: "user" | "assistant"; content: string }> = [];
      if (recentTranscripts.length > 0) {
        const contextText =
          "Recent consultation transcript:\n" +
          recentTranscripts
            .reverse()
            .map((t) => t.content)
            .join("\n");
        history.push({ role: "user", content: contextText });
        history.push({ role: "assistant", content: "Understood. I have the consultation context and am ready to help." });
      }
      for (const msg of pastMessages) {
        history.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }

      // Persist user message
      await ctx.db.insert(chatMessage).values({
        sessionId: input.sessionId,
        role: "user",
        content: input.message,
      });

      // Call AI agent
      const assistantText = await ctx.callHealthChat(history, input.message);

      // Persist assistant response
      await ctx.db.insert(chatMessage).values({
        sessionId: input.sessionId,
        role: "assistant",
        content: assistantText,
      });

      return { message: assistantText };
    }),
});
