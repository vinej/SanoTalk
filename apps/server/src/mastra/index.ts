import { Mastra } from "@mastra/core";
import { summaryAgent } from "./agents/summary.js";
import { soapNoteAgent } from "./agents/soap-note.js";
import { db, agentRun, transcriptSummary, transcript } from "@sanotalk/db";
import { eq, asc } from "drizzle-orm";
import { logger } from "../logger.js";
import { PinoLogger } from '@mastra/loggers'

import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

export const mastra = new Mastra({
  agents: { summaryAgent, soapNoteAgent },
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
    if (sessionId) {
      const rows = await db.query.transcript.findMany({
        where: eq(transcript.sessionId, sessionId),
        orderBy: [asc(transcript.startMs)],
      });
      logger.info({ runId: run.id, rowCount: rows.length }, "Transcript rows found");
      transcriptContent = rows.map((r) => r.content).join("\n");
    }

    if (!transcriptContent) {
      logger.warn({ runId: run.id, sessionId }, "No transcript content — aborting agent run");
      await db.update(agentRun)
        .set({ status: "error", errorMessage: "No transcript content available for this session", completedAt: new Date() })
        .where(eq(agentRun.id, run.id));
      return;
    }

    const agent = mastra.getAgent(run.agentName as "summaryAgent");
    logger.info({ runId: run.id }, "Calling agent...");
    const result = await agent.generate(transcriptContent);
    logger.info({ runId: run.id, textLength: result.text.length, preview: result.text.slice(0, 100) }, "Agent responded");

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
        logger.error({ runId: run.id, rawText: result.text.slice(0, 500), parseErr }, "Failed to parse agent JSON output");
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
