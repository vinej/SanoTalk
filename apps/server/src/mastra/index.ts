import { Mastra } from "@mastra/core";
import { summaryAgent } from "./agents/summary.ts";
import { soapNoteAgent } from "./agents/soap-note.ts";
import { db, agentRun } from "@sanotalk/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger.ts";

export const mastra = new Mastra({
  agents: { summaryAgent, soapNoteAgent },
  logger: {
    type: "CONSOLE",
    level: "INFO",
  },
});

export async function runPendingAgents() {
  const pending = await db.query.agentRun.findMany({
    where: eq(agentRun.status, "pending"),
  });

  for (const run of pending) {
    void (async () => {
      try {
        await db
          .update(agentRun)
          .set({ status: "running", startedAt: new Date() })
          .where(eq(agentRun.id, run.id));

        const agent = mastra.getAgent(run.agentName as "summaryAgent");
        const result = await agent.generate(JSON.stringify(run.input));

        await db
          .update(agentRun)
          .set({
            status: "success",
            output: { text: result.text },
            completedAt: new Date(),
          })
          .where(eq(agentRun.id, run.id));
      } catch (err) {
        logger.error({ err, runId: run.id }, "Agent run failed");
        await db
          .update(agentRun)
          .set({
            status: "error",
            errorMessage: err instanceof Error ? err.message : String(err),
            completedAt: new Date(),
          })
          .where(eq(agentRun.id, run.id));
      }
    })();
  }
}
