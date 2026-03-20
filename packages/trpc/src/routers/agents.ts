import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc.js";
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
          sessionId: input.sessionId,
          agentName: "transcript-summary",
          input: { sessionId: input.sessionId },
          status: "pending",
        })
        .returning();
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
