import { useEffect, useRef, useState } from "react";
import { trpc } from "../lib/trpc";

interface TranscriptMessage {
  type: "transcript";
  text: string;
  isFinal: boolean;
  confidence: number;
}

export function useTranscriptSocket(sessionId: string) {
  const [liveText, setLiveText] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const utils = trpc.useUtils();

  const saveMutation = trpc.transcripts.save.useMutation({
    onSuccess: () => {
      void utils.transcripts.bySession.invalidate({ sessionId });
    },
  });

  useEffect(() => {
    const wsUrl = `${import.meta.env.VITE_WS_URL ?? "ws://localhost:3001"}/ws/transcribe?sessionId=${sessionId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data as string) as TranscriptMessage;
      if (data.type === "transcript") {
        setLiveText(data.text);
        if (data.isFinal && data.text.trim()) {
          saveMutation.mutate({
            sessionId,
            content: data.text,
            confidence: data.confidence,
          });
          setTimeout(() => setLiveText(""), 2000);
        }
      }
    };

    return () => ws.close();
  }, [sessionId]);

  const sendAudioChunk = (chunk: Blob | ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(chunk);
    }
  };

  return { liveText, sendAudioChunk };
}
