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
import { auth, checkAccountLockout, recordFailedLogin, clearFailedLogins } from "@sanotalk/trpc/auth";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { logger } from "./logger";
import { startDeepgramWebSocket } from "./deepgram";
import { runPendingAgents, triggerAgentRun, callHealthChat, callCompanionChat, callNewsChat, callPharmacistChat, callDrugInfoChat, callExerciseChat, callEatwellChat, callTestChat } from "./mastra/index";
import { joinAiParticipant, removeAiParticipant, removeAllAiParticipants, isAiAssistant } from "./ai-voice/index";
import http from "http";
import crypto from "crypto";
import { existsSync, readFileSync } from "fs";

// Fail fast if critical env vars are missing
const REQUIRED_ENV = [
  "APP_URL", "DATABASE_URL", "BETTER_AUTH_URL",
  "MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY",
  "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET",
  "DEEPGRAM_API_KEY", "ENCRYPTION_KEY", "BETTER_AUTH_SECRET",
] as const;
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnv.join(", ")}`);
}
if (process.env.NODE_ENV === "production" && process.env.MINIO_ACCESS_KEY === "minioadmin") {
  throw new Error("Default MinIO credentials detected in production — change MINIO_ACCESS_KEY and MINIO_SECRET_KEY");
}
if (process.env.NODE_ENV === "production" && process.env.BETTER_AUTH_SECRET?.includes("your-super-secret")) {
  throw new Error("Default BETTER_AUTH_SECRET detected in production — set a strong random secret");
}

const app = express();
// Trust only the first proxy hop (Cloudflare/nginx on the same host).
// In production behind Cloudflare, set TRUSTED_PROXY=loopback or the proxy IP.
app.set('trust proxy', process.env.TRUSTED_PROXY ?? "loopback");
const PORT = process.env.PORT ?? 3001;

// ─── Security Headers ──────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === "production";

// ─── HTTPS redirect (production behind a reverse proxy) ──────────────────
// Only redirects when x-forwarded-proto is explicitly "http", meaning a
// reverse proxy (Cloudflare/Nginx) forwarded an HTTP request.  Direct
// local access (no proxy header) is left alone so local testing works.
if (isProduction) {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] === "http") {
      res.redirect(301, `https://${req.hostname}${req.originalUrl}`);
      return;
    }
    next();
  });
}

// CSP directives shared between Helmet (API responses) and the nonce-aware
// SPA handler (HTML responses).  The SPA handler adds a per-request nonce to
// script-src so we can avoid 'unsafe-inline' entirely.
const cspConnectSrc = [
  "'self'",
  "wss://localhost:*",
  "wss://*.livekit.cloud",
  "https://api.nal.usda.gov",
  "https://www.themealdb.com",
  "https://rxnav.nlm.nih.gov",
  "https://api.fda.gov",
  process.env.LIVEKIT_URL ?? "",
  process.env.VITE_API_URL ?? "",
].filter(Boolean);

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org", "https://api.dicebear.com", "https://avatars.dicebear.com", "https://www.gravatar.com"],
  fontSrc: ["'self'"],
  connectSrc: cspConnectSrc,
  mediaSrc: ["'self'"],
  workerSrc: ["'self'"],
  frameSrc: ["'none'"],
  frameAncestors: ["'none'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  upgradeInsecureRequests: [],
};

app.use(helmet({
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  xContentTypeOptions: true,
  // CSP for API responses (no nonce needed — no scripts served)
  contentSecurityPolicy: { directives: cspDirectives },
}));

// Permissions-Policy header (Helmet doesn't have built-in support)
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self), payment=()");
  next();
});

// ─── CORS ─────────────────────────────────────────────────────────────────
// Only trust NGROK_URL if it matches a real ngrok domain pattern
function isValidNgrokUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && /^[a-z0-9-]+\.ngrok(-free)?\.app$/.test(parsed.hostname);
  } catch {
    return false;
  }
}

const allowedOrigins = [
  process.env.APP_URL,
  // Trust both www and non-www variants
  ...(process.env.APP_URL ? [process.env.APP_URL.replace("://", "://www.")] : []),
  ...(process.env.NODE_ENV !== "production" && isValidNgrokUrl(process.env.NGROK_URL) ? [process.env.NGROK_URL] : []),
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
  max: process.env.NODE_ENV === "production" ? 100 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: () => process.env.NODE_ENV !== "production",
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

// Strict limiter for OTP/2FA — 10 attempts per 5 minutes per IP
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 10 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification attempts, please try again later." },
});

// ─── Permissions-Policy ───────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()");
  next();
});

app.use(express.json({ limit: "1mb" }));

// ─── Better Auth ───────────────────────────────────────────────────────────
app.use("/api/auth/two-factor/send-otp", otpLimiter);
app.use("/api/auth/two-factor/verify-otp", otpLimiter);
app.use("/api/auth/two-factor/verify-totp", otpLimiter);
app.use("/api/auth/email-verification", otpLimiter);
// Per-account lockout on sign-in: block after 5 consecutive failures for 15 min
app.use("/api/auth/sign-in/email", express.json(), (req, res, next) => {
  const email = (req.body as { email?: string } | undefined)?.email?.toLowerCase();
  if (email) {
    try {
      checkAccountLockout(email);
    } catch {
      res.status(429).json({ error: { message: "Account temporarily locked. Please try again later." } });
      return;
    }
  }
  // After auth response, track success/failure
  const origEnd = res.end.bind(res);
  res.end = function (...args: Parameters<typeof origEnd>) {
    if (email) {
      if (res.statusCode >= 400) recordFailedLogin(email);
      else clearFailedLogins(email);
    }
    return origEnd(...args);
  } as typeof res.end;
  next();
});
app.use("/api/auth", authLimiter, toNodeHandler(auth));

// ─── tRPC ─────────────────────────────────────────────────────────────────
// Cap batched tRPC requests to 10 procedures per HTTP call
const MAX_TRPC_BATCH = 10;
app.use("/api/trpc", (req, res, next) => {
  const procedures = (req.path.split("/").pop() ?? "").split(",");
  if (procedures.length > MAX_TRPC_BATCH) {
    res.status(400).json({ error: `Batch too large (max ${MAX_TRPC_BATCH})` });
    return;
  }
  next();
});
// Rate-limit public consent endpoint to prevent table pollution (no auth required)
app.use("/api/trpc/privacy.recordConsent", rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
}));
// Medical limiters first — these specific routes get the stricter limit only
app.use("/api/trpc/agents.generateSummary", medicalLimiter);
app.use("/api/trpc/agents.sendSummary", medicalLimiter);
app.use("/api/trpc/agents.sendChatMessage", medicalLimiter);
app.use("/api/trpc/agents.sendHealthChatMessage", medicalLimiter);
app.use("/api/trpc/agents.sendCompanionChatMessage", medicalLimiter);
app.use("/api/trpc/agents.sendNewsChatMessage", medicalLimiter);
app.use("/api/trpc/agents.sendPharmacistChatMessage", medicalLimiter);
app.use("/api/trpc/agents.sendDrugInfoChatMessage", medicalLimiter);
app.use("/api/trpc/agents.sendExerciseChatMessage", medicalLimiter);
app.use("/api/trpc/agents.sendEatwellChatMessage", medicalLimiter);
app.use("/api/trpc/agents.sendTestChatMessage", medicalLimiter);
app.use("/api/trpc/privacy.exportMyData", medicalLimiter);
app.use("/api/trpc/vitals.shareWithProfessional", medicalLimiter);
app.use("/api/trpc/medications.shareWithProfessional", medicalLimiter);
app.use("/api/trpc/symptoms.shareWithProfessional", medicalLimiter);
app.use("/api/trpc/privacy.requestDeletion", medicalLimiter);
app.use("/api/trpc/privacy.cancelDeletion", medicalLimiter);
// General API limiter for all other tRPC routes
app.use("/api/trpc", apiLimiter);
// CSRF protection: require custom header on all tRPC requests (triggers CORS preflight on cross-origin)
app.use("/api/trpc", (req, res, next) => {
  if (req.method !== "OPTIONS" && req.headers["x-trpc-source"] !== "sanotalk-web") {
    res.status(403).json({ error: "Missing required header" });
    return;
  }
  next();
});
// Prevent caching of API responses (tRPC may return decrypted PHI)
app.use("/api/trpc", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
});
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: (opts) => createTRPCContext(opts, { triggerAgentRun, callHealthChat, callCompanionChat, callNewsChat, callPharmacistChat, callDrugInfoChat, callExerciseChat, callEatwellChat, callTestChat, joinAiParticipant, removeAiParticipant, removeAllAiParticipants, isAiAssistant }),
    onError({ path, error }) {
      logger.error({ path, code: error.code }, "tRPC error");
    },
  })
);

// ─── Avatar proxy ─────────────────────────────────────────────────────────
// Serves user avatars so the browser never needs direct access to MinIO.
import { snapshotErData } from "@sanotalk/trpc/lib/er-snapshot";
import { db, user as userTable, chatMessage, transcript, agentRun, dataRetentionPolicy, recording, talkSession } from "@sanotalk/db";
import { eq, lte, and, sql, inArray } from "drizzle-orm";
import { deleteMinioObjects } from "@sanotalk/trpc/lib/minio-cleanup";
import * as Minio from "minio";

let _avatarMinio: Minio.Client | null = null;
function getAvatarMinio(): Minio.Client {
  if (!_avatarMinio) {
    _avatarMinio = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT!,
      port: parseInt(process.env.MINIO_PORT ?? "9000"),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    });
  }
  return _avatarMinio;
}

// Allowed external avatar domains (DiceBear, Gravatar, etc.)
const ALLOWED_AVATAR_HOSTS = new Set([
  "api.dicebear.com",
  "avatars.dicebear.com",
  "www.gravatar.com",
  "gravatar.com",
]);

function isAllowedAvatarUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_AVATAR_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

app.get("/api/avatar/:userId", apiLimiter, async (req, res) => {
  try {
    const userId = req.params.userId as string;
    if (!userId) { res.status(400).end(); return; }

    const defaultAvatar = "https://api.dicebear.com/9.x/initials/svg?seed=ST";
    // Validate userId format to prevent arbitrary DB queries
    if (!/^[\w-]{1,100}$/.test(userId)) { res.redirect(defaultAvatar); return; }
    const record = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
      columns: { image: true },
    });
    if (!record?.image) {
      res.redirect(defaultAvatar);
      return;
    }

    // External URLs — only redirect to allowlisted domains
    if (record.image.startsWith("http://") || record.image.startsWith("https://")) {
      if (!isAllowedAvatarUrl(record.image)) { res.redirect(defaultAvatar); return; }
      res.redirect(record.image);
      return;
    }

    // MinIO key — validate format before fetching (prevent serving arbitrary objects)
    if (!/^avatars\/[\w-]+\.(jpg|png|webp)$/.test(record.image)) { res.redirect(defaultAvatar); return; }
    const client = getAvatarMinio();
    const bucket = process.env.MINIO_BUCKET ?? "sanotalk";
    const stream = await client.getObject(bucket, record.image);
    const ext = record.image.split(".").pop();
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=3600");
    stream.pipe(res);
  } catch {
    // Return default avatar on any error to prevent user enumeration
    res.redirect("https://api.dicebear.com/9.x/initials/svg?seed=ST");
  }
});

// ─── Health ────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── SPA static serving (production) ──────────────────────────────────────
// In production, serve the built web app so Helmet security headers apply to
// the HTML page (HSTS, CSP, Referrer-Policy, X-Content-Type-Options).
// In development, Vite dev server handles serving and proxies API calls here.
const webDistPath = resolve(__dirname, "../../../apps/web/dist");
if (isProduction && existsSync(webDistPath)) {
  // Read index.html once at startup — nonces are injected per-request below
  const indexHtmlTemplate = readFileSync(resolve(webDistPath, "index.html"), "utf-8");

  app.use(express.static(webDistPath, { index: false }));

  // SPA fallback — injects a per-request CSP nonce into every <script> tag
  // so script-src can use 'nonce-xxx' instead of 'unsafe-inline'.
  app.get("/{*splat}", (req, res) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/ws/")) return res.status(404).end();

    const nonce = crypto.randomBytes(16).toString("base64");

    // Inject nonce into all <script> tags
    const html = indexHtmlTemplate.replace(/<script/g, `<script nonce="${nonce}"`);

    // Build CSP with the nonce — overrides Helmet's static CSP for this response
    const directives = [
      `default-src 'self'`,
      `script-src 'self' 'nonce-${nonce}'`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: https://*.tile.openstreetmap.org https://api.dicebear.com https://avatars.dicebear.com https://www.gravatar.com`,
      `font-src 'self'`,
      `connect-src ${cspConnectSrc.join(" ")}`,
      `media-src 'self'`,
      `worker-src 'self'`,
      `frame-src 'none'`,
      `frame-ancestors 'none'`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `upgrade-insecure-requests`,
    ].join("; ");

    res.setHeader("Content-Security-Policy", directives);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });
  logger.info("Serving SPA from apps/web/dist (nonce-based CSP)");
}

// ─── HTTP + WebSocket server ───────────────────────────────────────────────
const server = http.createServer(app);
startDeepgramWebSocket(server, allowedOrigins);

if (!process.env.NODE_ENV) {
  // In Docker / production containers, NODE_ENV must be set — fail hard.
  if (process.env.DOCKER === "true" || process.env.KUBERNETES_SERVICE_HOST) {
    throw new Error("NODE_ENV must be set in containerized environments. Set NODE_ENV=production.");
  }
  logger.warn("NODE_ENV is not set — security controls (rate limits, secure cookies) will use permissive defaults. Set NODE_ENV=production for production deployments.");
}

// ─── Mutual exclusion for purge jobs ─────────────────────────────────────
let purgeRunning = false;

// ─── Data Retention & Purge Jobs (Law 25) ────────────────────────────────
// Default retention days (used when no row exists in the policy table)
const DEFAULT_RETENTION: Record<string, number> = {
  chat_message: 365,
  transcript: 730,
  agent_run: 90,
};

async function getRetentionDays(dataType: string): Promise<number> {
  try {
    const [row] = await db
      .select({ retentionDays: dataRetentionPolicy.retentionDays })
      .from(dataRetentionPolicy)
      .where(eq(dataRetentionPolicy.dataType, dataType));
    return row?.retentionDays ?? DEFAULT_RETENTION[dataType] ?? 365;
  } catch {
    return DEFAULT_RETENTION[dataType] ?? 365;
  }
}

async function purgeExpiredData() {
  try {
    const now = new Date();

    const chatDays = await getRetentionDays("chat_message");
    const chatCutoff = new Date(now.getTime() - chatDays * 24 * 60 * 60 * 1000);
    await db.delete(chatMessage).where(lte(chatMessage.createdAt, chatCutoff));

    const transcriptDays = await getRetentionDays("transcript");
    const transcriptCutoff = new Date(now.getTime() - transcriptDays * 24 * 60 * 60 * 1000);
    await db.delete(transcript).where(lte(transcript.createdAt, transcriptCutoff));

    const agentDays = await getRetentionDays("agent_run");
    const agentCutoff = new Date(now.getTime() - agentDays * 24 * 60 * 60 * 1000);
    await db.delete(agentRun).where(lte(agentRun.startedAt, agentCutoff));

    logger.info({ chatDays, transcriptDays, agentDays }, "Data retention purge completed");
  } catch (err) {
    logger.error({ err }, "Data retention purge failed");
  }
}

async function purgeDeletedAccounts() {
  try {
    const now = new Date();
    const users = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(lte((userTable as any).deletionScheduledFor, now));

    for (const u of users) {
      // Collect MinIO recording objects before cascade delete removes the rows
      const sessions = await db
        .select({ id: talkSession.id })
        .from(talkSession)
        .where(eq(talkSession.hostId, u.id));
      if (sessions.length > 0) {
        const recs = await db
          .select({ storageKey: recording.storageKey, storageBucket: recording.storageBucket })
          .from(recording)
          .where(inArray(recording.sessionId, sessions.map((s) => s.id)));
        if (recs.length > 0) void deleteMinioObjects(recs);
      }

      await db.delete(userTable).where(eq(userTable.id, u.id));
      logger.info({ userId: u.id }, "Account permanently deleted (Law 25)");
    }
  } catch (err) {
    logger.error({ err }, "Account purge failed");
  }
}

server.listen(PORT, () => {
  logger.info(`🚀 SanoTalk server running on http://localhost:${PORT}`);
  void runPendingAgents();
  void snapshotErData(db);
  setInterval(() => void snapshotErData(db), 30 * 60 * 1000);

  // Run data retention purge + account deletion daily (with mutual exclusion)
  async function runPurgeJobs() {
    if (purgeRunning) { logger.warn("Purge jobs already running, skipping"); return; }
    purgeRunning = true;
    try {
      await purgeExpiredData();
      await purgeDeletedAccounts();
    } finally {
      purgeRunning = false;
    }
  }
  void runPurgeJobs();
  setInterval(() => void runPurgeJobs(), 24 * 60 * 60 * 1000);
});

// ─── Graceful shutdown ───────────────────────────────────────────────────
function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  // Force exit after 10s if connections linger
  setTimeout(() => { logger.warn("Forcing exit after timeout"); process.exit(1); }, 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled rejection");
});
