import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { WebSocket, WebSocketServer } from "ws";
import type { Server } from "http";
import { logger } from "./logger";

export function startDeepgramWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws/transcribe" });
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY ?? "");

  wss.on("connection", (ws: WebSocket, req) => {
    logger.info({ url: req.url }, "Transcription WS client connected");

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      logger.error("DEEPGRAM_API_KEY is not set");
      ws.close();
      return;
    }

    const audioBuffer: Buffer<ArrayBufferLike>[] = [];

    const dgConnection = deepgram.listen.live({
      model: "nova-2",
      language: "fr",
      smart_format: true,
      diarize: true,
      punctuate: true,
      interim_results: true,
      utterance_end_ms: 1000,
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

      dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel.alternatives[0];
        logger.info({ text: transcript?.transcript, isFinal: data.is_final }, "Deepgram transcript event");
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
    });

    ws.on("close", () => {
      dgConnection.requestClose();
      logger.info("Transcription WS client disconnected");
    });
  });

  logger.info("Deepgram WebSocket proxy ready at /ws/transcribe");
}
