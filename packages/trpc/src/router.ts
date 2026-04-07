import { createTRPCRouter } from "./trcp";
import { sessionsRouter } from "./routers/sessions";
import { transcriptsRouter } from "./routers/transcripts";
import { livekitRouter } from "./routers/livekit";
import { agentsRouter } from "./routers/agents";
import { storageRouter } from "./routers/storage";
import { tasksRouter } from "./routers/tasks";
import { userRouter } from "./routers/user";
import { wsRouter } from "./routers/ws";
import { healthHelpRouter } from "./routers/healthHelp";
import { vitalsRouter } from "./routers/vitals";

export const appRouter = createTRPCRouter({
  sessions: sessionsRouter,
  transcripts: transcriptsRouter,
  livekit: livekitRouter,
  agents: agentsRouter,
  storage: storageRouter,
  tasks: tasksRouter,
  user: userRouter,
  ws: wsRouter,
  healthHelp: healthHelpRouter,
  vitals: vitalsRouter,
});

export type AppRouterSonoTalk = typeof appRouter;
