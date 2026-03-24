import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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

// ─── Security Headers ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.BETTER_AUTH_URL,
  process.env.APP_URL,
].filter((o): o is string => typeof o === "string" && o.startsWith("http"));

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

// ─── Rate Limiting ─────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: "10mb" }));

// ─── Better Auth ───────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, toNodeHandler(auth));

// ─── tRPC ─────────────────────────────────────────────────────────────────
app.use("/api/trpc", apiLimiter);
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
