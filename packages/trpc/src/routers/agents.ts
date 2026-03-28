import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { agentRun, talkSession as talkSessionTable, chatMessage, transcript, user, transcriptSummary, userProperty, task } from "@sanotalk/db";
import { resend } from "../lib/resend";
import { eq, asc, desc, isNull, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

type DB = Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"];

/** Fetches all key/value properties + propertiesLanguage for a user to pass as AI context. */
async function getUserContext(db: DB, userId: string) {
  const [properties, userRow] = await Promise.all([
    db
      .select({ key: userProperty.key, value: userProperty.value })
      .from(userProperty)
      .where(eq(userProperty.userId, userId)),
    db
      .select({ propertiesLanguage: user.propertiesLanguage })
      .from(user)
      .where(eq(user.id, userId)),
  ]);
  return {
    properties,
    propertiesLanguage: userRow[0]?.propertiesLanguage ?? "en",
  };
}

/** Throws FORBIDDEN if the user is not the host or a participant of the session. */
async function assertSessionAccess(
  db: Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"],
  sessionId: string,
  userId: string
) {
  const session = await db.query.talkSession.findFirst({
    where: eq(talkSessionTable.id, sessionId),
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
      const run = await ctx.db.query.agentRun.findFirst({
        where: eq(agentRun.id, input.runId),
      });
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      const sessionId = (run.input as { sessionId?: string } | null)?.sessionId;
      if (!sessionId) throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      await assertSessionAccess(ctx.db, sessionId, ctx.user.id);
      return run;
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

      // Get session language for AI response language
      const sessionRow = await ctx.db.query.talkSession.findFirst({
        where: eq(talkSessionTable.id, input.sessionId),
      });
      const sessionLanguage = sessionRow?.language ?? "en";

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

      // Fetch user properties + language for AI context
      const { properties: userProperties, propertiesLanguage } = await getUserContext(ctx.db, ctx.user.id);

      // Call AI agent
      const assistantText = await ctx.callHealthChat(history, input.message, sessionLanguage, userProperties, propertiesLanguage);

      // Persist assistant response
      await ctx.db.insert(chatMessage).values({
        sessionId: input.sessionId,
        role: "assistant",
        content: assistantText,
      });

      return { message: assistantText };
    }),

  generalChatHistory: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.query.chatMessage.findMany({
        where: and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "general")),
        orderBy: [asc(chatMessage.createdAt)],
      });
    }),

  sendGeneralChatMessage: protectedProcedure
    .input(z.object({
      message: z.string().min(1).max(2000),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pastMessages = await ctx.db.query.chatMessage.findMany({
        where: and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "general")),
        orderBy: [asc(chatMessage.createdAt)],
        limit: 20,
      });

      const history: Array<{ role: "user" | "assistant"; content: string }> = pastMessages.map(
        (msg) => ({ role: msg.role as "user" | "assistant", content: msg.content })
      );

      await ctx.db.insert(chatMessage).values({ userId: ctx.user.id, chatType: "general", role: "user", content: input.message });

      const { properties: userProperties, propertiesLanguage } = await getUserContext(ctx.db, ctx.user.id);
      const assistantText = await ctx.callHealthChat(history, input.message, input.language ?? "en", userProperties, propertiesLanguage);

      await ctx.db.insert(chatMessage).values({ userId: ctx.user.id, chatType: "general", role: "assistant", content: assistantText });

      return { message: assistantText };
    }),

  companionChatHistory: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.query.chatMessage.findMany({
        where: and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "companion")),
        orderBy: [asc(chatMessage.createdAt)],
      });
    }),

  sendCompanionChatMessage: protectedProcedure
    .input(z.object({
      message: z.string().min(1).max(2000),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pastMessages = await ctx.db.query.chatMessage.findMany({
        where: and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "companion")),
        orderBy: [asc(chatMessage.createdAt)],
        limit: 20,
      });

      const history: Array<{ role: "user" | "assistant"; content: string }> = pastMessages.map(
        (msg) => ({ role: msg.role as "user" | "assistant", content: msg.content })
      );

      await ctx.db.insert(chatMessage).values({ userId: ctx.user.id, chatType: "companion", role: "user", content: input.message });

      const { properties: userProperties, propertiesLanguage } = await getUserContext(ctx.db, ctx.user.id);
      const assistantText = await ctx.callCompanionChat(history, input.message, input.language ?? "en", userProperties, propertiesLanguage);

      await ctx.db.insert(chatMessage).values({ userId: ctx.user.id, chatType: "companion", role: "assistant", content: assistantText });

      return { message: assistantText };
    }),

  clearGeneralChat: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db.delete(chatMessage).where(
        and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "general"))
      );
      return { cleared: true };
    }),

  clearCompanionChat: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db.delete(chatMessage).where(
        and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "companion"))
      );
      return { cleared: true };
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

      const expectedRole = input.recipientType === "doctor" ? "doctor" : "pharmacist";
      if ((recipient as any).role !== expectedRole) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Linked provider does not have the required role" });
      }

      const summary = await ctx.db.query.transcriptSummary.findFirst({
        where: eq(transcriptSummary.sessionId, input.sessionId),
      });

      if (!summary) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No summary available yet" });
      }

      const session = await ctx.db.query.talkSession.findFirst({
        where: eq(talkSessionTable.id, input.sessionId),
      });
      const sessionLanguage = session?.language ?? "en";

      const taskTitleByLang: Record<string, string> = {
        en: `Review summary for patient ${sender.name}`,
        fr: `Réviser le résumé du patient ${sender.name}`,
        es: `Revisar el resumen del paciente ${sender.name}`,
        zh: `查看患者 ${sender.name} 的摘要`,
        ar: `مراجعة ملخص المريض ${sender.name}`,
        hi: `मरीज़ ${sender.name} का सारांश देखें`,
      };
      const taskTitle = taskTitleByLang[sessionLanguage] ?? taskTitleByLang["en"]!;

      const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
      const appUrl = process.env.APP_URL ?? "";
      const summaryUrl = `${appUrl}/sessions/${input.sessionId}?tab=summary`;

      await resend.emails.send({
        from,
        to: recipient.email,
        subject: `SanoTalk — Consultation summary available for ${sender.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#1a1a1a">Consultation Summary Available</h2>
            <p style="color:#555">A new consultation summary from <strong>${sender.name}</strong> is ready to view.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
            <p style="color:#333">For security and privacy reasons, medical details are not included in this email.</p>
            <p>
              <a href="${summaryUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
                View Summary
              </a>
            </p>
            <p style="color:#999;font-size:12px;margin-top:24px">
              You must be logged in to SanoTalk to view the summary.
              If you did not expect this notification, you can ignore it.
            </p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
            <p style="color:#999;font-size:11px">Sent from SanoTalk. This summary was generated by AI and is for informational purposes only.</p>
          </div>
        `,
      });

      await ctx.db.insert(task).values({
        title: taskTitle,
        description: summaryUrl,
        status: "assigned",
        assignedUserId: recipient.id,
        taskType: "summary_review",
      });

      return { sent: true, to: recipient.email };
    }),
});
