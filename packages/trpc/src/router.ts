import { createTRPCRouter } from "./trpc.js";
import { sessionsRouter } from "./routers/sessions.js";
import { transcriptsRouter } from "./routers/transcripts.js";
import { livekitRouter } from "./routers/livekit.js";
import { agentsRouter } from "./routers/agents.js";
import { storageRouter } from "./routers/storage.js";

export const appRouter = createTRPCRouter({
  sessions: sessionsRouter,
  transcripts: transcriptsRouter,
  livekit: livekitRouter,
  agents: agentsRouter,
  storage: storageRouter,
});

export type AppRouter = typeof appRouter;
