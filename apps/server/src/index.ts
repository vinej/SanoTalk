import "dotenv/config";
import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "@sanotalk/trpc";
import { createTRPCContext } from "@sanotalk/trpc";
import { auth } from "@sanotalk/trpc/auth";
import { toNodeHandler } from "better-auth/node";
import { logger } from "./logger";
import { startDeepgramWebSocket } from "./deepgram";
import { runPendingAgents, triggerAgentRun } from "./mastra/index";
import http from "http";

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─── CORS ─────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      process.env.BETTER_AUTH_URL!,
      process.env.APP_URL!,
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(express.json({ limit: "10mb" }));

// ─── Better Auth ───────────────────────────────────────────────────────────
app.use("/api/auth", toNodeHandler(auth));

// ─── tRPC ─────────────────────────────────────────────────────────────────
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: (opts) => createTRPCContext(opts, { triggerAgentRun }),
    onError({ path, error }) {
      logger.error({ path, error }, "tRPC error");
    },
  })
);

// ─── Health ────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── HTTP + WebSocket server ───────────────────────────────────────────────
const server = http.createServer(app);
startDeepgramWebSocket(server);

server.listen(PORT, () => {
  logger.info(`🚀 SanoTalk server running on http://localhost:${PORT}`);
  void runPendingAgents();
});
