import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { agentRun, talkSession } from "@sanotalk/db";
import { eq } from "drizzle-orm";
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
});
