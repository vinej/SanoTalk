import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { logger } from "./logger";
import { auth } from "@sanotalk/trpc/auth";
import { db } from "@sanotalk/db";
import { talkSession, sessionParticipant } from "@sanotalk/db";
import { eq, and } from "drizzle-orm";

export function startDeepgramWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/transcribe" });
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY ?? "");

  wss.on("connection", async (ws: WebSocket, req) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const sessionId = url.searchParams.get("sessionId");
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // If a sessionId is provided it must be a valid UUID
    if (sessionId && !uuidRegex.test(sessionId)) {
      logger.warn({ url: req.url }, "WebSocket rejected: invalid sessionId format");
      ws.close(1008, "Invalid sessionId");
      return;
    }

    // Verify the caller is authenticated
    const sessionData = await auth.api.getSession({
      headers: new Headers(req.headers as Record<string, string>),
    });
    if (!sessionData?.user) {
      logger.warn({ sessionId }, "WebSocket rejected: unauthenticated");
      ws.close(1008, "Unauthorized");
      return;
    }
    const userId = sessionData.user.id;

    // When a sessionId is provided, verify the user belongs to that session
    if (sessionId) {
      const talk = await db.query.talkSession.findFirst({
        where: eq(talkSession.id, sessionId),
      });
      if (!talk) {
        logger.warn({ sessionId, userId }, "WebSocket rejected: session not found");
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
          ws.close(1008, "Access denied");
          return;
        }
      }
    }

    logger.info({ sessionId: sessionId ?? "general", userId }, "WebSocket authorized");

    // Map i18n language codes to Deepgram-compatible BCP-47 codes
    const langMap: Record<string, string> = {
      zh: "zh-CN",
    };
    const rawLang = url.searchParams.get("language") ?? "en";
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
    ws.on("message", (data) => {
      const buf = data as Buffer<ArrayBufferLike>;
      audioChunkCount++;
      if (audioChunkCount <= 3 || audioChunkCount % 40 === 0) {
        logger.info({ chunk: audioChunkCount, bytes: buf.length }, "Audio chunk received");
      }
      if (dgConnection.getReadyState() === 1) {
        dgConnection.send(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
      } else {
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
        logger.info({ accumulatedText }, "Deepgram UtteranceEnd — flushing to client");
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
      logger.info("Transcription WS client disconnected");
    });
  });

  logger.info("Deepgram WebSocket proxy ready at /ws/transcribe");
}
