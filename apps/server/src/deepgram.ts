import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { logger } from "./logger";
import { auth } from "@sanotalk/trpc/auth";
import { db } from "@sanotalk/db";
import { talkSession, sessionParticipant } from "@sanotalk/db";
import { eq, and } from "drizzle-orm";
import { consumeTicket } from "@sanotalk/trpc/lib/ws-tickets";

const MAX_WS_PER_USER = 2;
const WS_CONNECT_LIMIT = 10;
const WS_CONNECT_WINDOW = 60_000; // 1 minute
const wsAttemptsByIp = new Map<string, { count: number; resetAt: number }>();

export function startDeepgramWebSocket(server: Server, allowedOrigins?: string[]) {
  const wss = new WebSocketServer({
    server,
    path: "/ws/transcribe",
    maxPayload: 256 * 1024, // 256 KB — audio frames are typically under 64 KB
    verifyClient: ({ req }, done) => {
      const origin = req.headers.origin;
      if (!origin || !allowedOrigins?.includes(origin)) {
        done(false, 403, "Origin not allowed");
        return;
      }
      // IP-based connection rate limiting (before auth to protect DB)
      const ip = req.socket.remoteAddress ?? "unknown";
      const now = Date.now();
      const entry = wsAttemptsByIp.get(ip) ?? { count: 0, resetAt: now + WS_CONNECT_WINDOW };
      if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + WS_CONNECT_WINDOW; }
      entry.count++;
      wsAttemptsByIp.set(ip, entry);
      if (entry.count > WS_CONNECT_LIMIT) {
        logger.warn({ ip }, "WebSocket rejected: IP rate limit exceeded");
        done(false, 429, "Too many connection attempts");
        return;
      }
      done(true);
    },
  });
  if (!process.env.DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY is required");
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  const wsCountByUser = new Map<string, number>();

  wss.on("connection", async (ws: WebSocket, req) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const sessionId = url.searchParams.get("sessionId");
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // If a sessionId is provided it must be a valid UUID
    if (sessionId && !uuidRegex.test(sessionId)) {
      logger.warn({ sessionId: "[redacted]" }, "WebSocket rejected: invalid sessionId format");
      ws.close(1008, "Invalid sessionId");
      return;
    }

    // Verify the caller is authenticated.
    // Cookie auth works for same-domain setups; behind Cloudflare the auth cookie
    // may not be forwarded for cross-subdomain WS upgrades, so the client passes
    // the session token as a WebSocket subprotocol ("bearer <token>").
    // The token is never placed in the URL to avoid log exposure.
    let userId: string | undefined;

    const cookieSession = await auth.api.getSession({
      headers: new Headers(req.headers as Record<string, string>),
    });
    if (cookieSession?.user) {
      userId = cookieSession.user.id;
    } else {
      // Extract short-lived ticket from Sec-WebSocket-Protocol: "ticket.<uuid>"
      const protocols = (req.headers["sec-websocket-protocol"] ?? "").split(",").map((p) => p.trim());
      const ticketEntry = protocols.find((p) => p.startsWith("ticket."));
      const ticketId = ticketEntry?.slice("ticket.".length);
      if (ticketId) {
        userId = consumeTicket(ticketId) ?? undefined;
      }
    }

    if (!userId) {
      logger.warn({ sessionId }, "WebSocket rejected: unauthenticated");
      ws.close(1008, "Unauthorized");
      return;
    }

    // Enforce per-user connection limit
    const currentCount = wsCountByUser.get(userId) ?? 0;
    if (currentCount >= MAX_WS_PER_USER) {
      logger.warn({ userId, currentCount }, "WebSocket rejected: per-user limit reached");
      ws.close(1008, "Too many connections");
      return;
    }
    wsCountByUser.set(userId, currentCount + 1);

    // When a sessionId is provided, verify the user belongs to that session
    if (sessionId) {
      const talk = await db.query.talkSession.findFirst({
        where: eq(talkSession.id, sessionId),
      });
      if (!talk) {
        logger.warn({ sessionId, userId }, "WebSocket rejected: session not found");
        wsCountByUser.set(userId, (wsCountByUser.get(userId) ?? 1) - 1);
        ws.close(1008, "Session not found");
        return;
      }

      const isHost = talk.hostId === userId;
      if (!isHost) {
        const participant = await db.query.sessionParticipant.findFirst({
          where: and(
            eq(sessionParticipant.sessionId, sessionId),
            eq(sessionParticipant.userId, userId)
          ),
        });
        if (!participant) {
          logger.warn({ sessionId, userId }, "WebSocket rejected: user not in session");
          wsCountByUser.set(userId, (wsCountByUser.get(userId) ?? 1) - 1);
          ws.close(1008, "Access denied");
          return;
        }
      }
    }

    logger.info({ sessionId: sessionId ?? "general", userId }, "WebSocket authorized");

    // Map i18n language codes to Deepgram-compatible BCP-47 codes
    const ALLOWED_LANGUAGES = new Set(["en", "fr", "es", "zh", "ar", "hi"]);
    const langMap: Record<string, string> = {
      zh: "zh-CN",
    };
    const rawLang = url.searchParams.get("language") ?? "en";
    if (!ALLOWED_LANGUAGES.has(rawLang)) {
      logger.warn({ rawLang }, "WebSocket rejected: unsupported language");
      ws.close(1008, "Unsupported language");
      return;
    }
    const dgLanguage = langMap[rawLang] ?? rawLang;

    logger.info({ sessionId, language: dgLanguage }, "Transcription WS client connected");

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      logger.error("DEEPGRAM_API_KEY is not set");
      ws.close();
      return;
    }

    const audioBuffer: Buffer<ArrayBufferLike>[] = [];

    const dgConnection = deepgram.listen.live({
      model: "nova-2",
      language: dgLanguage,
      smart_format: true,
      diarize: true,
      punctuate: true,
      interim_results: true,
      utterance_end_ms: 2000,
    });

    dgConnection.on(LiveTranscriptionEvents.Error, (err) => {
      logger.error({ err }, "Deepgram error");
    });

    let audioChunkCount = 0;

    // Buffer audio that arrives before Deepgram is ready
    ws.on("message", (data, isBinary) => {
      if (!isBinary) { ws.close(1003, "Only binary audio data accepted"); return; }
      const buf = data as Buffer<ArrayBufferLike>;
      audioChunkCount++;
      if (audioChunkCount <= 3 || audioChunkCount % 40 === 0) {
        logger.info({ chunk: audioChunkCount, bytes: buf.length }, "Audio chunk received");
      }
      if (dgConnection.getReadyState() === 1) {
        dgConnection.send(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
      } else if (audioBuffer.length < 50) {
        audioBuffer.push(buf);
      }
    });

    dgConnection.on(LiveTranscriptionEvents.Open, () => {
      logger.info({ buffered: audioBuffer.length }, "Deepgram connection opened");

      // Flush buffered audio
      for (const chunk of audioBuffer) {
        dgConnection.send(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer);
      }
      audioBuffer.length = 0;

      // Accumulate final transcript text; only flush on UtteranceEnd
      let accumulatedText = "";
      let accumulatedConfidence = 1;

      dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel.alternatives[0];
        if (!transcript) return;

        if (data.is_final && transcript.transcript.trim()) {
          // Append to accumulated buffer — do NOT send isFinal yet
          accumulatedText += (accumulatedText ? " " : "") + transcript.transcript.trim();
          accumulatedConfidence = transcript.confidence;
        }

        // Always send interim text for live display
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "transcript",
            text: accumulatedText || transcript.transcript,
            isFinal: false, // never trigger send until UtteranceEnd
            confidence: transcript.confidence,
            words: transcript.words,
          }));
        }
      });

      dgConnection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        logger.info({ chars: accumulatedText.length }, "Deepgram UtteranceEnd — flushing to client");
        if (accumulatedText.trim() && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "transcript",
            text: accumulatedText.trim(),
            isFinal: true,
            confidence: accumulatedConfidence,
            words: [],
          }));
          accumulatedText = "";
        }
      });
    });

    ws.on("close", () => {
      dgConnection.requestClose();
      const n = (wsCountByUser.get(userId!) ?? 1) - 1;
      if (n <= 0) wsCountByUser.delete(userId!);
      else wsCountByUser.set(userId!, n);
      logger.info("Transcription WS client disconnected");
    });
  });

  logger.info("Deepgram WebSocket proxy ready at /ws/transcribe");
}
