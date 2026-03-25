import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { agentRun, talkSession, chatMessage, transcript, user, transcriptSummary } from "@sanotalk/db";
import { resend } from "../lib/resend";
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

  sendSummary: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      recipientType: z.enum(["doctor", "pharmacist"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx.db, input.sessionId, ctx.user.id);

      const sender = await ctx.db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
        with: { linkedDoctor: true, linkedPharmacist: true },
      });

      if (!sender || (sender as any).role !== "patient") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only patients can send summaries" });
      }

      const recipient = input.recipientType === "doctor"
        ? (sender as any).linkedDoctor
        : (sender as any).linkedPharmacist;

      if (!recipient) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No linked provider of that type" });
      }

      const summary = await ctx.db.query.transcriptSummary.findFirst({
        where: eq(transcriptSummary.sessionId, input.sessionId),
      });

      if (!summary) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No summary available yet" });
      }

      const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
      const keyPointsHtml = ((summary.keyPoints ?? []) as string[])
        .map((pt) => `<li style="margin-bottom:4px">${pt}</li>`)
        .join("");
      const soap = (summary.soapNote ?? {}) as any;

      await resend.emails.send({
        from,
        to: recipient.email,
        subject: `SanoTalk — Consultation summary for ${sender.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1a1a1a">Consultation Summary</h2>
            <p style="color:#555">Patient: <strong>${sender.name}</strong></p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
            <h3 style="color:#1a1a1a">Summary</h3>
            <p style="color:#333;line-height:1.6">${summary.summary}</p>
            ${keyPointsHtml ? `
              <h3 style="color:#1a1a1a">Key Points</h3>
              <ul style="color:#333;line-height:1.6">${keyPointsHtml}</ul>
            ` : ""}
            ${soap ? `
              <h3 style="color:#1a1a1a">SOAP Note</h3>
              <p><strong>S (Subjective):</strong> ${soap.subjective ?? ""}</p>
              <p><strong>O (Objective):</strong> ${soap.objective ?? ""}</p>
              <p><strong>A (Assessment):</strong> ${soap.assessment ?? ""}</p>
              <p><strong>P (Plan):</strong> ${soap.plan ?? ""}</p>
            ` : ""}
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
            <p style="color:#999;font-size:12px">Sent from SanoTalk. This summary was generated by AI and is for informational purposes only.</p>
          </div>
        `,
      });

      return { sent: true, to: recipient.email };
    }),
});
