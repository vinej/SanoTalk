import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { agentRun, talkSession as talkSessionTable, chatMessage, transcript, user, transcriptSummary, userProperty, task, savedConversation, userLink, vitalSign, medication, symptomLog, allergy, chronicCondition } from "@sanotalk/db";
import { resend } from "../lib/resend";
import { escapeHtml } from "../lib/escape-html";
import { eq, asc, desc, isNull, and, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

type DB = Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"];

/** Fetches all key/value properties + propertiesLanguage + recent vitals for a user to pass as AI context. */
async function getUserContext(db: DB, userId: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0]!;

  const [properties, userRow, recentVitals, activeMedications, recentSymptoms, userAllergies, userConditions] = await Promise.all([
    db
      .select({ key: userProperty.key, value: userProperty.value })
      .from(userProperty)
      .where(eq(userProperty.userId, userId)),
    db
      .select({ propertiesLanguage: user.propertiesLanguage })
      .from(user)
      .where(eq(user.id, userId)),
    db
      .select()
      .from(vitalSign)
      .where(eq(vitalSign.userId, userId))
      .orderBy(desc(vitalSign.measuredAt))
      .limit(20),
    db
      .select()
      .from(medication)
      .where(and(eq(medication.userId, userId), eq(medication.isActive, true)))
      .orderBy(desc(medication.startDate))
      .limit(20),
    db
      .select()
      .from(symptomLog)
      .where(and(eq(symptomLog.userId, userId), gte(symptomLog.date, sevenDaysAgoStr)))
      .orderBy(desc(symptomLog.date))
      .limit(7),
    db
      .select()
      .from(allergy)
      .where(eq(allergy.userId, userId)),
    db
      .select()
      .from(chronicCondition)
      .where(eq(chronicCondition.userId, userId)),
  ]);
  // Filter out sensitive PII that AI agents should never see
  const SENSITIVE_KEYS = new Set(["ramq_number", "ramq_expiry"]);
  const safeProperties = properties.filter(p => !SENSITIVE_KEYS.has(p.key));

  return {
    properties: safeProperties,
    propertiesLanguage: userRow[0]?.propertiesLanguage ?? "en",
    recentVitals,
    activeMedications,
    recentSymptoms,
    userAllergies,
    userConditions,
  };
}

/** Builds a vitals context message pair for AI agents. */
function buildVitalsContext(vitals: typeof vitalSign.$inferSelect[]): Array<{ role: "user" | "assistant"; content: string }> {
  if (vitals.length === 0) return [];

  // Group by type and pick latest per type
  const latestByType = new Map<string, typeof vitalSign.$inferSelect>();
  for (const v of vitals) {
    if (!latestByType.has(v.type)) latestByType.set(v.type, v);
  }

  const lines = Array.from(latestByType.values()).map((v) => {
    const value = v.type === "blood_pressure" && v.valueSecondary != null
      ? `${v.valuePrimary}/${v.valueSecondary}`
      : v.type === "temperature"
        ? v.valuePrimary.toFixed(1)
        : Math.round(v.valuePrimary).toString();
    const date = new Date(v.measuredAt).toISOString().split("T")[0];
    return `- ${v.type}: ${value} ${v.unit} (measured ${date})`;
  });

  return [
    { role: "user" as const, content: `My recent vital sign readings:\n${lines.join("\n")}` },
    { role: "assistant" as const, content: "Noted. I'll take your vital signs into account when assessing your health questions." },
  ];
}

/** Builds a medications context message pair for AI agents. */
function buildMedicationsContext(meds: typeof medication.$inferSelect[]): Array<{ role: "user" | "assistant"; content: string }> {
  if (meds.length === 0) return [];

  const lines = meds.map((m) => {
    const since = new Date(m.startDate).toISOString().split("T")[0];
    const parts = [`- ${m.name} ${m.dosage}, ${m.frequency}`];
    if (m.route) parts[0] += ` (${m.route})`;
    parts[0] += ` (since ${since})`;
    if (m.reason) parts[0] += ` — ${m.reason}`;
    return parts[0];
  });

  return [
    { role: "user" as const, content: `My current medications:\n${lines.join("\n")}` },
    { role: "assistant" as const, content: "Noted. I'll take your medications into account when assessing your health questions and flag any potential interactions." },
  ];
}

/** Builds a symptoms context message pair for AI agents. */
function buildSymptomsContext(logs: typeof symptomLog.$inferSelect[]): Array<{ role: "user" | "assistant"; content: string }> {
  if (logs.length === 0) return [];

  const lines = logs.map((l) => {
    const parts: string[] = [];
    if (l.painLevel != null) parts.push(`pain ${l.painLevel}/10`);
    if (l.mood != null) parts.push(`mood ${l.mood}/10`);
    if (l.energy != null) parts.push(`energy ${l.energy}/10`);
    if (l.sleepHours != null) parts.push(`sleep ${l.sleepHours}h`);
    if (l.sleepQuality != null) parts.push(`sleep quality ${l.sleepQuality}/10`);
    if (l.stress != null) parts.push(`stress ${l.stress}/10`);
    if (l.appetite != null) parts.push(`appetite ${l.appetite}/10`);
    const symptoms = l.customSymptoms && l.customSymptoms.length > 0
      ? `. Symptoms: ${l.customSymptoms.join(", ")}`
      : "";
    return `- ${l.date}: ${parts.join(", ")}${symptoms}`;
  });

  return [
    { role: "user" as const, content: `My symptom journal (last 7 days):\n${lines.join("\n")}` },
    { role: "assistant" as const, content: "Noted. I'll take your recent symptoms, mood, energy, and sleep patterns into account." },
  ];
}

/** Builds an allergy & condition context message pair for AI agents. */
function buildAllergyContext(
  allergies: typeof allergy.$inferSelect[],
  conditions: typeof chronicCondition.$inferSelect[],
): Array<{ role: "user" | "assistant"; content: string }> {
  if (allergies.length === 0 && conditions.length === 0) return [];

  const sections: string[] = [];

  if (allergies.length > 0) {
    const lines = allergies.map((a) => {
      const sev = a.severity === "life_threatening" ? "LIFE-THREATENING" : a.severity.toUpperCase();
      const reaction = a.reaction ? ` — ${a.reaction}` : "";
      return `- ${a.type.toUpperCase()}: ${a.name} (${sev}${reaction})`;
    });
    sections.push(`ALLERGIES:\n${lines.join("\n")}`);
  }

  if (conditions.length > 0) {
    const active = conditions.filter((c) => c.status === "active" || c.status === "managed");
    if (active.length > 0) {
      const lines = active.map((c) => {
        const parts = [c.name, c.status];
        if (c.diagnosedDate) parts.push(`since ${c.diagnosedDate}`);
        if (c.medications && c.medications.length > 0) parts.push(`on ${c.medications.join(", ")}`);
        return `- ${parts.join(", ")}`;
      });
      sections.push(`CHRONIC CONDITIONS (active):\n${lines.join("\n")}`);
    }
  }

  return [
    { role: "user" as const, content: sections.join("\n\n") },
    { role: "assistant" as const, content: "Noted. I'll take your allergies and chronic conditions into account. I will never suggest medications you are allergic to, and I'll consider your conditions when assessing health questions." },
  ];
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
    .input(z.object({
      sessionId: z.string().uuid(),
      agentType: z.enum(["health", "companion", "pharmacist"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx.db, input.sessionId, ctx.user.id);
      const agentType = input.agentType ?? "health";
      const agentName = agentType === "companion"
        ? "companionSummaryAgent"
        : agentType === "pharmacist"
          ? "pharmacistSummaryAgent"
          : "healthSummaryAgent";
      const [run] = await ctx.db
        .insert(agentRun)
        .values({
          agentName,
          input: { sessionId: input.sessionId, agentType },
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
      agentType: z.enum(["health", "companion", "pharmacist"]).optional(),
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

      // Fetch user properties + language + vitals + medications + symptoms for AI context
      const { properties: userProperties, propertiesLanguage, recentVitals, activeMedications, recentSymptoms, userAllergies, userConditions } = await getUserContext(ctx.db, ctx.user.id);
      const vitalsContext = buildVitalsContext(recentVitals);
      const medsContext = buildMedicationsContext(activeMedications);
      const symptomsContext = buildSymptomsContext(recentSymptoms);
      const allergyContext = buildAllergyContext(userAllergies, userConditions);
      const fullHistory = [...vitalsContext, ...medsContext, ...symptomsContext, ...allergyContext, ...history];

      // Call the selected AI agent
      const callAgent = input.agentType === "companion"
        ? ctx.callCompanionChat
        : input.agentType === "pharmacist"
          ? ctx.callPharmacistChat
          : ctx.callHealthChat;
      const assistantText = await callAgent(fullHistory, input.message, sessionLanguage, userProperties, propertiesLanguage);

      // Persist assistant response
      await ctx.db.insert(chatMessage).values({
        sessionId: input.sessionId,
        role: "assistant",
        content: assistantText,
      });

      return { message: assistantText };
    }),

  healthChatHistory: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.query.chatMessage.findMany({
        where: and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "health")),
        orderBy: [asc(chatMessage.createdAt)],
      });
    }),

  sendHealthChatMessage: protectedProcedure
    .input(z.object({
      message: z.string().min(1).max(2000),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pastMessages = await ctx.db.query.chatMessage.findMany({
        where: and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "health")),
        orderBy: [asc(chatMessage.createdAt)],
        limit: 20,
      });

      const history: Array<{ role: "user" | "assistant"; content: string }> = pastMessages.map(
        (msg) => ({ role: msg.role as "user" | "assistant", content: msg.content })
      );

      await ctx.db.insert(chatMessage).values({ userId: ctx.user.id, chatType: "health", role: "user", content: input.message });

      const { properties: userProperties, propertiesLanguage, recentVitals, activeMedications, recentSymptoms, userAllergies, userConditions } = await getUserContext(ctx.db, ctx.user.id);
      const vitalsContext = buildVitalsContext(recentVitals);
      const medsContext = buildMedicationsContext(activeMedications);
      const symptomsContext = buildSymptomsContext(recentSymptoms);
      const allergyContext = buildAllergyContext(userAllergies, userConditions);
      const fullHistory = [...vitalsContext, ...medsContext, ...symptomsContext, ...allergyContext, ...history];
      const assistantText = await ctx.callHealthChat(fullHistory, input.message, input.language ?? "en", userProperties, propertiesLanguage);

      await ctx.db.insert(chatMessage).values({ userId: ctx.user.id, chatType: "health", role: "assistant", content: assistantText });

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

      const { properties: userProperties, propertiesLanguage, recentVitals, activeMedications, recentSymptoms, userAllergies, userConditions } = await getUserContext(ctx.db, ctx.user.id);
      const vitalsContext = buildVitalsContext(recentVitals);
      const medsContext = buildMedicationsContext(activeMedications);
      const symptomsContext = buildSymptomsContext(recentSymptoms);
      const allergyContext = buildAllergyContext(userAllergies, userConditions);
      const fullHistory = [...vitalsContext, ...medsContext, ...symptomsContext, ...allergyContext, ...history];
      const assistantText = await ctx.callCompanionChat(fullHistory, input.message, input.language ?? "en", userProperties, propertiesLanguage);

      await ctx.db.insert(chatMessage).values({ userId: ctx.user.id, chatType: "companion", role: "assistant", content: assistantText });

      return { message: assistantText };
    }),

  clearHealthChat: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db.delete(chatMessage).where(
        and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "health"))
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

  newsChatHistory: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.query.chatMessage.findMany({
        where: and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "news")),
        orderBy: [asc(chatMessage.createdAt)],
      });
    }),

  sendNewsChatMessage: protectedProcedure
    .input(z.object({
      message: z.string().min(1).max(2000),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pastMessages = await ctx.db.query.chatMessage.findMany({
        where: and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "news")),
        orderBy: [asc(chatMessage.createdAt)],
        limit: 20,
      });

      const history: Array<{ role: "user" | "assistant"; content: string }> = pastMessages.map(
        (msg) => ({ role: msg.role as "user" | "assistant", content: msg.content })
      );

      await ctx.db.insert(chatMessage).values({ userId: ctx.user.id, chatType: "news", role: "user", content: input.message });

      const { properties: userProperties, propertiesLanguage } = await getUserContext(ctx.db, ctx.user.id);
      const assistantText = await ctx.callNewsChat(history, input.message, input.language ?? "en", userProperties, propertiesLanguage);

      await ctx.db.insert(chatMessage).values({ userId: ctx.user.id, chatType: "news", role: "assistant", content: assistantText });

      return { message: assistantText };
    }),

  clearNewsChat: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db.delete(chatMessage).where(
        and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "news"))
      );
      return { cleared: true };
    }),

  pharmacistChatHistory: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.query.chatMessage.findMany({
        where: and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "pharmacist")),
        orderBy: [asc(chatMessage.createdAt)],
      });
    }),

  sendPharmacistChatMessage: protectedProcedure
    .input(z.object({
      message: z.string().min(1).max(2000),
      language: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pastMessages = await ctx.db.query.chatMessage.findMany({
        where: and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "pharmacist")),
        orderBy: [asc(chatMessage.createdAt)],
        limit: 20,
      });

      const history: Array<{ role: "user" | "assistant"; content: string }> = pastMessages.map(
        (msg) => ({ role: msg.role as "user" | "assistant", content: msg.content })
      );

      await ctx.db.insert(chatMessage).values({ userId: ctx.user.id, chatType: "pharmacist", role: "user", content: input.message });

      const { properties: userProperties, propertiesLanguage, recentVitals, activeMedications, recentSymptoms, userAllergies, userConditions } = await getUserContext(ctx.db, ctx.user.id);
      const vitalsContext = buildVitalsContext(recentVitals);
      const medsContext = buildMedicationsContext(activeMedications);
      const symptomsContext = buildSymptomsContext(recentSymptoms);
      const allergyContext = buildAllergyContext(userAllergies, userConditions);
      const fullHistory = [...vitalsContext, ...medsContext, ...symptomsContext, ...allergyContext, ...history];
      const assistantText = await ctx.callPharmacistChat(fullHistory, input.message, input.language ?? "en", userProperties, propertiesLanguage);

      await ctx.db.insert(chatMessage).values({ userId: ctx.user.id, chatType: "pharmacist", role: "assistant", content: assistantText });

      return { message: assistantText };
    }),

  clearPharmacistChat: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.db.delete(chatMessage).where(
        and(isNull(chatMessage.sessionId), eq(chatMessage.userId, ctx.user.id), eq(chatMessage.chatType, "pharmacist"))
      );
      return { cleared: true };
    }),

  sendSummary: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid(),
      recipientUserId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertSessionAccess(ctx.db, input.sessionId, ctx.user.id);

      const sender = await ctx.db.query.user.findFirst({
        where: eq(user.id, ctx.user.id),
      });

      if (!sender || (sender as any).role !== "patient") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only patients can send summaries" });
      }

      // Verify the recipient is linked to this patient
      const link = await ctx.db.query.userLink.findFirst({
        where: and(eq(userLink.patientId, ctx.user.id), eq(userLink.professionalId, input.recipientUserId)),
      });
      if (!link) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Recipient is not linked to this patient" });
      }

      const recipient = await ctx.db.query.user.findFirst({
        where: eq(user.id, input.recipientUserId),
      });

      if (!recipient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Recipient not found" });
      }

      if ((recipient as any).role !== "doctor" && (recipient as any).role !== "pharmacist") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Recipient must be a doctor or pharmacist" });
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
            <p style="color:#555">A new consultation summary from <strong>${escapeHtml(sender.name)}</strong> is ready to view.</p>
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

      return { sent: true };
    }),

  listSavedConversations: protectedProcedure
    .input(z.object({ chatType: z.enum(["health", "companion", "news", "pharmacist"]) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: savedConversation.id,
          title: savedConversation.title,
          chatType: savedConversation.chatType,
          createdAt: savedConversation.createdAt,
        })
        .from(savedConversation)
        .where(
          and(
            eq(savedConversation.userId, ctx.user.id),
            eq(savedConversation.chatType, input.chatType)
          )
        )
        .orderBy(desc(savedConversation.createdAt));
    }),

  saveConversation: protectedProcedure
    .input(z.object({
      chatType: z.enum(["health", "companion", "news", "pharmacist"]),
      title: z.string().min(1).max(120),
    }))
    .mutation(async ({ ctx, input }) => {
      const liveMessages = await ctx.db.query.chatMessage.findMany({
        where: and(
          isNull(chatMessage.sessionId),
          eq(chatMessage.userId, ctx.user.id),
          eq(chatMessage.chatType, input.chatType)
        ),
        orderBy: [asc(chatMessage.createdAt)],
      });
      if (liveMessages.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No messages to save" });
      }
      const snapshot = liveMessages.map((m) => ({ role: m.role, content: m.content }));

      const existing = await ctx.db.query.savedConversation.findFirst({
        where: and(
          eq(savedConversation.userId, ctx.user.id),
          eq(savedConversation.chatType, input.chatType),
          eq(savedConversation.title, input.title)
        ),
      });

      if (existing) {
        const [updated] = await ctx.db
          .update(savedConversation)
          .set({ messages: snapshot, createdAt: new Date() })
          .where(eq(savedConversation.id, existing.id))
          .returning();
        return updated;
      }

      const [saved] = await ctx.db
        .insert(savedConversation)
        .values({
          userId: ctx.user.id,
          chatType: input.chatType,
          title: input.title,
          messages: snapshot,
        })
        .returning();
      return saved;
    }),

  loadSavedConversation: protectedProcedure
    .input(z.object({ savedId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const saved = await ctx.db.query.savedConversation.findFirst({
        where: and(
          eq(savedConversation.id, input.savedId),
          eq(savedConversation.userId, ctx.user.id)
        ),
      });
      if (!saved) throw new TRPCError({ code: "NOT_FOUND", message: "Saved conversation not found" });
      const chatType = saved.chatType as "health" | "companion" | "news" | "pharmacist";
      await ctx.db.delete(chatMessage).where(
        and(
          isNull(chatMessage.sessionId),
          eq(chatMessage.userId, ctx.user.id),
          eq(chatMessage.chatType, chatType)
        )
      );
      const msgs = saved.messages as Array<{ role: string; content: string }>;
      if (msgs.length > 0) {
        await ctx.db.insert(chatMessage).values(
          msgs.map((m) => ({
            userId: ctx.user.id,
            chatType,
            role: m.role,
            content: m.content,
          }))
        );
      }
      return { loaded: true, chatType };
    }),

  deleteSavedConversation: protectedProcedure
    .input(z.object({ savedId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.savedConversation.findFirst({
        where: and(
          eq(savedConversation.id, input.savedId),
          eq(savedConversation.userId, ctx.user.id)
        ),
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Saved conversation not found" });
      await ctx.db.delete(savedConversation).where(eq(savedConversation.id, input.savedId));
      return { deleted: true };
    }),
});
