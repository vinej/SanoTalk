import { createTRPCRouter } from "./trcp";
import { sessionsRouter } from "./routers/sessions";
import { transcriptsRouter } from "./routers/transcripts";
import { livekitRouter } from "./routers/livekit";
import { agentsRouter } from "./routers/agents";
import { storageRouter } from "./routers/storage";
import { tasksRouter } from "./routers/tasks";

export const appRouter = createTRPCRouter({
  sessions: sessionsRouter,
  transcripts: transcriptsRouter,
  livekit: livekitRouter,
  agents: agentsRouter,
  storage: storageRouter,
  tasks: tasksRouter,
});

export type AppRouterSonoTalk = typeof appRouter;
