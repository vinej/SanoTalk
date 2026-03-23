import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { agentRun } from "@sanotalk/db";
import { eq } from "drizzle-orm";

export const agentsRouter = createTRPCRouter({
  generateSummary: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Kick off Mastra agent — handled server-side
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
