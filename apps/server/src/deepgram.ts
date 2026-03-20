import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { logger } from "./logger.js";

export function startDeepgramWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/transcribe" });
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

  wss.on("connection", (ws: WebSocket, req) => {
    logger.info({ url: req.url }, "Transcription WS client connected");

    const dgConnection = deepgram.listen.live({
      model: "nova-3-medical",
      language: "en",
      smart_format: true,
      diarize: true,
      punctuate: true,
      interim_results: true,
      utterance_end_ms: 1000,
    });

    dgConnection.on(LiveTranscriptionEvents.Open, () => {
      logger.info("Deepgram connection opened");

      ws.on("message", (data) => {
        if (dgConnection.getReadyState() === 1) {
          dgConnection.send(data as ArrayBuffer);
        }
      });

      dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel.alternatives[0];
        if (transcript && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "transcript",
              text: transcript.transcript,
              isFinal: data.is_final,
              confidence: transcript.confidence,
              words: transcript.words,
            })
          );
        }
      });

      dgConnection.on(LiveTranscriptionEvents.Error, (err) => {
        logger.error({ err }, "Deepgram error");
      });
    });

    ws.on("close", () => {
      dgConnection.finish();
      logger.info("Transcription WS client disconnected");
    });
  });

  logger.info("Deepgram WebSocket proxy ready at /ws/transcribe");
}
