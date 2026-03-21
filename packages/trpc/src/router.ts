import { createTRPCRouter } from "./trcp.js";
import { sessionsRouter } from "./routers/sessions";
import { transcriptsRouter } from "./routers/transcripts";
import { livekitRouter } from "./routers/livekit";
import { agentsRouter } from "./routers/agents";
import { storageRouter } from "./routers/storage";

export const appRouter = createTRPCRouter({
  sessions: sessionsRouter,
  transcripts: transcriptsRouter,
  livekit: livekitRouter,
  agents: agentsRouter,
  storage: storageRouter,
});

export type AppRouterSonoTalk = typeof appRouter;
