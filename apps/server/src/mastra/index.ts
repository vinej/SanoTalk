import { Mastra } from "@mastra/core";
import { summaryAgent } from "./agents/summary.js";
import { soapNoteAgent } from "./agents/soap-note.js";
import { healthChatAgent } from "./agents/health-chat.js";
import { companionChatAgent } from "./agents/companion-chat.js";
import { db, agentRun, transcriptSummary, transcript, chatMessage, talkSession } from "@sanotalk/db";
import { eq, asc } from "drizzle-orm";
import { logger } from "../logger.js";
import { PinoLogger } from '@mastra/loggers'

import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

export const mastra = new Mastra({
  agents: { summaryAgent, soapNoteAgent, healthChatAgent, companionChatAgent },
  logger: new PinoLogger({ name: 'Mastra', level: 'info' }),
});

async function executeRun(run: typeof agentRun.$inferSelect) {
  logger.info({ runId: run.id, agentName: run.agentName, input: run.input }, "executeRun started");

  await db.update(agentRun)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(agentRun.id, run.id));

  try {
    const input = run.input as { sessionId?: string } | null;
    const sessionId = input?.sessionId;

    logger.info({ runId: run.id, sessionId }, "Fetching transcripts for session");

    // Fetch transcript content for the session
    let transcriptContent = "";
    let sessionLanguage = "en";
    if (sessionId) {
      const sessionRow = await db.query.talkSession.findFirst({
        where: eq(talkSession.id, sessionId),
      });
      if (sessionRow) sessionLanguage = sessionRow.language;

      const rows = await db.query.transcript.findMany({
        where: eq(transcript.sessionId, sessionId),
        orderBy: [asc(transcript.startMs)],
      });
      logger.info({ runId: run.id, rowCount: rows.length }, "Transcript rows found");
      transcriptContent = rows.map((r) => r.content).join("\n");

      // Also include AI assistant conversation
      const chatRows = await db.query.chatMessage.findMany({
        where: eq(chatMessage.sessionId, sessionId),
        orderBy: [asc(chatMessage.createdAt)],
      });
      if (chatRows.length > 0) {
        const chatContent = chatRows
          .map((m) => `[${m.role === "user" ? "Patient" : "AI Assistant"}]: ${m.content}`)
          .join("\n");
        transcriptContent += "\n\n--- AI Assistant Conversation ---\n" + chatContent;
      }
    }

    if (!transcriptContent) {
      logger.warn({ runId: run.id, sessionId }, "No transcript content — aborting agent run");
      await db.update(agentRun)
        .set({ status: "error", errorMessage: "No transcript content available for this session", completedAt: new Date() })
        .where(eq(agentRun.id, run.id));
      return;
    }

    const agent = mastra.getAgent(run.agentName as "summaryAgent");
    logger.info({ runId: run.id, sessionLanguage }, "Calling agent...");
    const promptWithLanguage = `Respond in language code "${sessionLanguage}". All text fields in the JSON output must be written in that language.\n\n${transcriptContent}`;
    const result = await agent.generate(promptWithLanguage);
    logger.info({ runId: run.id, textLength: result.text.length }, "Agent responded");

    // Parse JSON from agent output and save to transcriptSummary
    if (sessionId) {
      try {
        // Strip markdown code fences if present
        const rawText = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
        const parsed = JSON.parse(rawText) as {
          summary: string;
          keyPoints: string[];
          actionItems: string[];
          soapNote: { subjective: string; objective: string; assessment: string; plan: string };
        };
        await db.insert(transcriptSummary)
          .values({
            sessionId,
            summary: parsed.summary,
            keyPoints: parsed.keyPoints,
            actionItems: parsed.actionItems,
            soapNote: parsed.soapNote,
          })
          .onConflictDoUpdate({
            target: transcriptSummary.sessionId,
            set: {
              summary: parsed.summary,
              keyPoints: parsed.keyPoints,
              actionItems: parsed.actionItems,
              soapNote: parsed.soapNote,
              updatedAt: new Date(),
            },
          });
        logger.info({ runId: run.id, sessionId }, "transcriptSummary saved to DB");
      } catch (parseErr) {
        logger.error({ runId: run.id, parseErr }, "Failed to parse agent JSON output");
      }
    }

    await db.update(agentRun)
      .set({ status: "success", output: { text: result.text }, completedAt: new Date() })
      .where(eq(agentRun.id, run.id));
  } catch (err) {
    logger.error({ err, runId: run.id }, "Agent run failed");
    await db.update(agentRun)
      .set({ status: "error", errorMessage: err instanceof Error ? err.message : String(err), completedAt: new Date() })
      .where(eq(agentRun.id, run.id));
  }
}

export async function runPendingAgents() {
  const pending = await db.query.agentRun.findMany({
    where: eq(agentRun.status, "pending"),
  });
  for (const run of pending) void executeRun(run);
}

export function triggerAgentRun(runId: string) {
  void (async () => {
    const run = await db.query.agentRun.findFirst({
      where: eq(agentRun.id, runId),
    });
    if (run) void executeRun(run);
  })();
}

type UserProperty = { key: string; value: string };

function buildPropertyContext(userProperties?: UserProperty[], propertiesLanguage = "en"): Array<{ role: "user" | "assistant"; content: string }> {
  if (!userProperties || userProperties.length === 0) return [];
  const lines = userProperties.map((p) => `- ${p.key}: ${p.value}`).join("\n");
  return [
    { role: "user" as const, content: `Personal context about me (written in language "${propertiesLanguage}"):\n${lines}` },
    { role: "assistant" as const, content: "Understood. I'll use this personal context throughout our conversation, regardless of the language it was written in." },
  ];
}

export async function callCompanionChat(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
  language = "en",
  userProperties?: UserProperty[],
  propertiesLanguage = "en"
): Promise<string> {
  const languageInstruction = { role: "user" as const, content: `Respond in language code "${language}". All your replies must be in that language.` };
  const languageAck = { role: "assistant" as const, content: "Understood. I will respond in the requested language." };
  const messages = [
    languageInstruction,
    languageAck,
    ...buildPropertyContext(userProperties, propertiesLanguage),
    ...history,
    { role: "user" as const, content: userMessage },
  ];
  const result = await companionChatAgent.generate(messages as any);
  return result.text;
}

export async function callHealthChat(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
  language = "en",
  userProperties?: UserProperty[],
  propertiesLanguage = "en"
): Promise<string> {
  const languageInstruction = { role: "user" as const, content: `Respond in language code "${language}". All your replies must be in that language.` };
  const languageAck = { role: "assistant" as const, content: "Understood. I will respond in the requested language." };
  const messages = [
    languageInstruction,
    languageAck,
    ...buildPropertyContext(userProperties, propertiesLanguage),
    ...history,
    { role: "user" as const, content: userMessage },
  ];
  const result = await healthChatAgent.generate(messages as any);
  return result.text;
}
