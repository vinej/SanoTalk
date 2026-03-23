import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { transcript, transcriptSummary } from "@sanotalk/db";
import { eq, asc } from "drizzle-orm";
export const transcriptsRouter = createTRPCRouter({
    bySession: protectedProcedure
        .input(z.object({ sessionId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
        return ctx.db.query.transcript.findMany({
            where: eq(transcript.sessionId, input.sessionId),
            orderBy: [asc(transcript.startMs)],
            with: { speaker: true },
        });
    }),
    summaryBySession: protectedProcedure
        .input(z.object({ sessionId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
        return ctx.db.query.transcriptSummary.findFirst({
            where: eq(transcriptSummary.sessionId, input.sessionId),
        });
    }),
    save: protectedProcedure
        .input(z.object({
        sessionId: z.string().uuid(),
        speakerId: z.string().optional(),
        speakerLabel: z.string().optional(),
        content: z.string(),
        confidence: z.number().optional(),
        startMs: z.number().optional(),
        endMs: z.number().optional(),
        rawDeepgramResult: z.unknown().optional(),
    }))
        .mutation(async ({ ctx, input }) => {
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
//# sourceMappingURL=transcripts.js.map