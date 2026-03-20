import "dotenv/config";
import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "@sanotalk/trpc";
import { createTRPCContext } from "@sanotalk/trpc";
import { auth } from "../../../packages/trpc/src/auth.ts";
import { toNodeHandler } from "better-auth/node";
import { logger } from "./logger.ts";
import { startDeepgramWebSocket } from "./deepgram.ts";
import { runPendingAgents } from "./mastra/index.ts";
import http from "http";

const app = express();
const PORT = process.env.PORT ?? 3001;

// ─── CORS ─────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      process.env.VITE_API_URL ?? "http://localhost:5173",
      "http://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(express.json({ limit: "10mb" }));

// ─── Better Auth ───────────────────────────────────────────────────────────
app.all("/api/auth/*", toNodeHandler(auth));

// ─── tRPC ─────────────────────────────────────────────────────────────────
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: createTRPCContext,
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
