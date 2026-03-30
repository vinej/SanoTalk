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
import { runPendingAgents, triggerAgentRun, callHealthChat, callCompanionChat, callNewsChat } from "./mastra/index";
import http from "http";

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT ?? 3001;

// ─── Security Headers ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-origin" },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      connectSrc: [
        "'self'",
        process.env.LIVEKIT_URL ?? "",
        process.env.VITE_API_URL ?? "",
      ].filter(Boolean),
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.BETTER_AUTH_URL,
  process.env.APP_URL,
  ...(process.env.NODE_ENV !== "production" ? [process.env.NGROK_URL] : []),
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
  max: process.env.NODE_ENV === "production" ? 30 : 500,
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

// Stricter limiter for AI-heavy medical endpoints (summary generation, email sending)
const medicalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

app.use(express.json({ limit: "10mb" }));

// ─── Better Auth ───────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, toNodeHandler(auth));

// ─── tRPC ─────────────────────────────────────────────────────────────────
app.use("/api/trpc", apiLimiter);
app.use("/api/trpc/agents.generateSummary", medicalLimiter);
app.use("/api/trpc/agents.sendSummary", medicalLimiter);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: (opts) => createTRPCContext(opts, { triggerAgentRun, callHealthChat, callCompanionChat, callNewsChat }),
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
