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
    let acquiredStream: MediaStream | null = null;

    const lang = options?.language ?? "en";
    const params = new URLSearchParams({ language: lang });
    if (sessionId) params.set("sessionId", sessionId);

    // Derive the WS base from the current origin at runtime (same pattern as
    // lib/trpc.ts and lib/auth-client.ts). Vite can't bake the production URL
    // at build time because the same bundle serves multiple environments, and
    // VITE_WS_URL in .env is only a dev-mode localhost fallback. In the
    // browser: use wss:// when the page is https, otherwise ws:// (local dev).
    // On SSR / no-window: fall back to VITE_WS_URL.
    const wsBase = (typeof window !== "undefined" && window.location?.origin)
      ? window.location.origin.replace(/^http/, "ws")
      : import.meta.env.VITE_WS_URL;

    if (!wsBase) {
      console.error("[mic] Unable to resolve WebSocket base URL");
      setMicError("Voice server URL not configured");
      return;
    }
    if (typeof window !== "undefined" && window.isSecureContext && !wsBase.startsWith("wss://")) {
      console.error("[mic] Refusing to open insecure ws:// from https:// page", { wsBase });
      setMicError("WebSocket URL misconfigured (must be wss://)");
      return;
    }
    const wsUrl = `${wsBase}/ws/transcribe?${params.toString()}`;

    // Feature/context preflight — surface a clear error instead of silently
    // doing nothing on non-secure contexts or old browsers.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      console.error("[mic] mediaDevices.getUserMedia not available", {
        isSecureContext: typeof window !== "undefined" && window.isSecureContext,
        protocol: typeof location !== "undefined" ? location.protocol : "?",
      });
      setMicError(
        typeof window !== "undefined" && !window.isSecureContext
          ? "Microphone requires HTTPS"
          : "Microphone not supported in this browser"
      );
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      console.error("[mic] MediaRecorder not available in this browser");
      setMicError("Audio recording not supported in this browser");
      return;
    }

    // Request mic FIRST (closest to the user-gesture that toggled voiceEnabled);
    // then fetch the WS ticket and open the socket. Deferring getUserMedia
    // behind ticket + WS round-trips can lose the gesture on some Android
    // browsers and cause the permission prompt to never appear.
    //
    // Explicit audio constraints fix two issues seen on Android Chrome:
    //   - Default mic gain on phones is often too low; without autoGainControl
    //     Deepgram receives audio below its speech-detection threshold and
    //     never produces any transcript events.
    //   - Echo/noise suppression cleans up phone-mic background noise that
    //     would otherwise trigger continuous "audio present" VAD and prevent
    //     UtteranceEnd from firing.
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
      video: false,
    })
      .then((stream) => {
        if (intentionallyClosed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        acquiredStream = stream;

        // iOS Safari's MediaRecorder does NOT support `audio/webm` — only
        // `audio/mp4` (AAC). Hardcoding webm throws NotSupportedError on
        // iPhone and the mic toggle appears to do nothing. Feature-detect
        // a supported container; Deepgram auto-detects the format so
        // webm/opus, mp4/aac, or the browser default all decode correctly.
        const candidates = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4;codecs=mp4a.40.2",
          "audio/mp4",
        ];
        const supported = typeof MediaRecorder.isTypeSupported === "function"
          ? candidates.find((t) => MediaRecorder.isTypeSupported(t))
          : undefined;
        let recorder: MediaRecorder;
        try {
          recorder = supported
            ? new MediaRecorder(stream, { mimeType: supported })
            : new MediaRecorder(stream);
        } catch (err) {
          const e = err as Error;
          console.error("[mic] MediaRecorder constructor failed", { name: e.name, message: e.message, mimeType: supported });
          setMicError(`Recorder init failed: ${e.name} — ${e.message}`);
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        recorderRef.current = recorder;
        console.info("[mic] recorder created", { mimeType: recorder.mimeType || supported || "(default)" });

        // Now fetch the WS ticket and open the socket.
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
              console.info("[mic] WebSocket open — starting recorder");
              recorder.ondataavailable = (e) => {
                if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                  ws.send(e.data);
                }
              };
              recorder.onstart = () => setIsRecording(true);
              recorder.onstop = () => setIsRecording(false);
              try {
                // Android Chrome's MediaRecorder produces malformed webm when
                // the timeslice is too small (under ~500ms) — Deepgram can't
                // stream-decode the fragmented clusters and silently drops
                // the audio. 1000ms gives the encoder enough runway to emit
                // well-formed clusters that Deepgram can parse. Desktop is
                // unaffected by the larger slice; live transcription latency
                // is still sub-second because interim results stream from
                // Deepgram the moment speech is detected.
                recorder.start(1000);
              } catch (err) {
                const e = err as Error;
                console.error("[mic] recorder.start failed", { name: e.name, message: e.message });
                setMicError(`Recorder start failed: ${e.name} — ${e.message}`);
              }
            };

            ws.onerror = (ev) => {
              console.error("[mic] WebSocket error", ev);
              if (!intentionallyClosed) setMicError("WebSocket connection failed");
            };

            ws.onclose = (ev) => {
              console.info("[mic] WebSocket closed", { code: ev.code, reason: ev.reason });
            };
          },
          onError: (err) => {
            console.error("[mic] ws.getTicket failed", err);
            if (!intentionallyClosed) setMicError(`Failed to obtain WS ticket: ${err.message ?? "unknown"}`);
          },
        });
      })
      .catch((err: Error) => {
        // Common names: NotAllowedError (denied), NotFoundError (no mic),
        // NotReadableError (hw busy), SecurityError (insecure context),
        // AbortError, OverconstrainedError. Surface the name so the user
        // can tell us what permission/state they're in.
        console.error("[mic] getUserMedia failed", { name: err.name, message: err.message });
        const friendly =
          err.name === "NotAllowedError" ? "Microphone permission denied — check site settings"
          : err.name === "NotFoundError" ? "No microphone found"
          : err.name === "NotReadableError" ? "Microphone is in use by another app"
          : err.name === "SecurityError" ? "Microphone blocked (insecure context or permissions policy)"
          : `${err.name}: ${err.message}`;
        setMicError(friendly);
      });

    return () => {
      intentionallyClosed = true;
      try { recorderRef.current?.stop(); } catch { /* ignore */ }
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      acquiredStream?.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      wsRef.current?.close();
    };
  }, [sessionId, enabled, options?.language]);

  return { liveText, isRecording, micError };
}
