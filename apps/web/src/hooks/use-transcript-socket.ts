import { useEffect, useRef, useState } from "react";
import { trpc } from "../lib/trpc";

interface TranscriptMessage {
  type: "transcript";
  text: string;
  isFinal: boolean;
  confidence: number;
}

export function useTranscriptSocket(
  sessionId: string | undefined,
  options?: {
    enabled?: boolean;
    onFinalTranscript?: (text: string) => void;
    language?: string;
  }
) {
  const [liveText, setLiveText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const utils = trpc.useUtils();

  const saveMutation = trpc.transcripts.save.useMutation({
    onSuccess: () => {
      if (sessionId) void utils.transcripts.bySession.invalidate({ sessionId });
    },
  });

  const getTicketMutation = trpc.ws.getTicket.useMutation();

  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    setMicError(null);
    setIsRecording(false);

    let intentionallyClosed = false;

    const lang = options?.language ?? "en";
    const params = new URLSearchParams({ language: lang });
    if (sessionId) params.set("sessionId", sessionId);
    const wsUrl = `${import.meta.env.VITE_WS_URL}/ws/transcribe?${params.toString()}`;

    getTicketMutation.mutate(undefined, {
      onSuccess: ({ ticket }) => {
        if (intentionallyClosed) return;
        const ws = new WebSocket(wsUrl, [`ticket.${ticket}`]);
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
              if (sessionId) {
                saveMutation.mutate({
                  sessionId,
                  content: data.text,
                  confidence: data.confidence,
                });
              }
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
              // mic access denied — error message not logged to avoid leaking to session replay
              setMicError(err.message);
            });
        };

        ws.onerror = () => {
          if (!intentionallyClosed) setMicError("WebSocket connection failed");
        };
      },
      onError: () => {
        if (!intentionallyClosed) setMicError("Failed to obtain WS ticket");
      },
    });

    return () => {
      intentionallyClosed = true;
      recorderRef.current?.stop();
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      wsRef.current?.close();
    };
  }, [sessionId, enabled, options?.language]);

  return { liveText, isRecording, micError };
}
