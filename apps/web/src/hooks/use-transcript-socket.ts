import { useEffect, useRef, useState } from "react";
import { trpc } from "../lib/trpc";

interface TranscriptMessage {
  type: "transcript";
  text: string;
  isFinal: boolean;
  confidence: number;
}

export function useTranscriptSocket(
  sessionId: string,
  options?: { onFinalTranscript?: (text: string) => void; language?: string }
) {
  const [liveText, setLiveText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const utils = trpc.useUtils();

  const saveMutation = trpc.transcripts.save.useMutation({
    onSuccess: () => {
      void utils.transcripts.bySession.invalidate({ sessionId });
    },
  });

  useEffect(() => {
    // Reset state for this mount
    setMicError(null);
    setIsRecording(false);

    const lang = options?.language ?? "en";
    const wsUrl = `${import.meta.env.VITE_WS_URL}/ws/transcribe?sessionId=${sessionId}&language=${lang}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event: MessageEvent) => {
      let data: TranscriptMessage;
      try {
        data = JSON.parse(event.data as string) as TranscriptMessage;
      } catch {
        return;
      }
      if (data.type === "transcript") {
        setLiveText(data.text);
        if (data.isFinal && data.text.trim()) {
          saveMutation.mutate({
            sessionId,
            content: data.text,
            confidence: data.confidence,
          });
          options?.onFinalTranscript?.(data.text);
          setTimeout(() => setLiveText(""), 2000);
        }
      }
    };

    ws.onopen = () => {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then((stream) => {
          const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
          recorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
              ws.send(e.data);
            }
          };

          recorder.onstart = () => setIsRecording(true);
          recorder.onstop = () => setIsRecording(false);

          recorder.start(250);
        })
        .catch((err: Error) => {
          console.error("[transcript] mic access denied:", err);
          setMicError(err.message);
        });
    };

    let intentionallyClosed = false;
    ws.onerror = () => {
      if (!intentionallyClosed) setMicError("WebSocket connection failed");
    };

    return () => {
      intentionallyClosed = true;
      recorderRef.current?.stop();
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      ws.close();
    };
  }, [sessionId]);

  return { liveText, isRecording, micError };
}
