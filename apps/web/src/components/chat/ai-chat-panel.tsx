import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { trpc } from "../../lib/trpc";
import { Loader2, Send, Mic, MicOff, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { useTranscriptSocket } from "../../hooks/use-transcript-socket";

interface Props {
  sessionId?: string;
  variant?: "general" | "companion";
  pendingVoiceText?: string;
  onVoiceTextConsumed?: () => void;
}

export function AiChatPanel({ sessionId, variant = "general", pendingVoiceText, onVoiceTextConsumed }: Props) {
  const { t, i18n } = useTranslation("sessions");
  const [inputValue, setInputValue] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isSessionMode = !!sessionId;
  const isCompanion = !isSessionMode && variant === "companion";

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: sessionMessages = [], refetch: refetchSession } = trpc.agents.chatHistory.useQuery(
    { sessionId: sessionId! },
    { enabled: isSessionMode }
  );
  const { data: generalMessages = [], refetch: refetchGeneral } = trpc.agents.generalChatHistory.useQuery(
    undefined,
    { enabled: !isSessionMode && !isCompanion }
  );
  const { data: companionMessages = [], refetch: refetchCompanion } = trpc.agents.companionChatHistory.useQuery(
    undefined,
    { enabled: isCompanion }
  );

  const messages = isSessionMode ? sessionMessages : isCompanion ? companionMessages : generalMessages;
  const refetch = isSessionMode ? refetchSession : isCompanion ? refetchCompanion : refetchGeneral;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const sendSessionMessage = trpc.agents.sendChatMessage.useMutation({ onSuccess: () => { void refetch(); } });
  const sendGeneralMessage = trpc.agents.sendGeneralChatMessage.useMutation({ onSuccess: () => { void refetch(); } });
  const sendCompanionMessage = trpc.agents.sendCompanionChatMessage.useMutation({ onSuccess: () => { void refetch(); } });
  const clearGeneral = trpc.agents.clearGeneralChat.useMutation({ onSuccess: () => { void refetch(); } });
  const clearCompanion = trpc.agents.clearCompanionChat.useMutation({ onSuccess: () => { void refetch(); } });

  const isPending = isSessionMode
    ? sendSessionMessage.isPending
    : isCompanion
      ? sendCompanionMessage.isPending
      : sendGeneralMessage.isPending;

  // ── Voice (non-session modes) ──────────────────────────────────────────────
  const { isRecording, micError } = useTranscriptSocket(undefined, {
    enabled: !isSessionMode && voiceEnabled,
    language: i18n.language,
    onFinalTranscript: (text) => {
      if (isCompanion) {
        sendCompanionMessage.mutate({ message: text, language: i18n.language });
      } else {
        sendGeneralMessage.mutate({ message: text, language: i18n.language });
      }
    },
  });

  // ── Send ───────────────────────────────────────────────────────────────────
  function handleSend() {
    const trimmed = inputValue.trim();
    if (!trimmed || isPending) return;
    setInputValue("");
    if (isSessionMode) {
      sendSessionMessage.mutate({ sessionId: sessionId!, message: trimmed });
    } else if (isCompanion) {
      sendCompanionMessage.mutate({ message: trimmed, language: i18n.language });
    } else {
      sendGeneralMessage.mutate({ message: trimmed, language: i18n.language });
    }
  }

  // Session mode: auto-send voice transcript from parent
  useEffect(() => {
    if (isSessionMode && voiceEnabled && pendingVoiceText && !isPending) {
      sendSessionMessage.mutate({ sessionId: sessionId!, message: pendingVoiceText });
      onVoiceTextConsumed?.();
    }
  }, [pendingVoiceText, voiceEnabled]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isPending]);

  const listening = isSessionMode ? voiceEnabled : (voiceEnabled && isRecording);

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      {!isSessionMode && (
        <div className={cn(
          "px-4 py-3 border-b font-semibold text-sm",
          isCompanion ? "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300" : "bg-muted/50 text-foreground"
        )}>
          {t(isCompanion ? "chat.titleCompanion" : "chat.titleGeneral")}
        </div>
      )}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {messages.length === 0 && !isPending && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t(isCompanion ? "chat.emptyCompanion" : "chat.empty")}
            </p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                msg.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : isCompanion
                    ? "mr-auto bg-sky-50 dark:bg-sky-950/30 text-foreground"
                    : "mr-auto bg-muted text-foreground"
              )}
            >
              {msg.content}
            </div>
          ))}

          {isPending && (
            <div className="mr-auto bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {listening && (
        <div className="border-t px-3 py-1.5 flex items-center gap-2 bg-red-500/10 shrink-0">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-600 font-medium">{t("chat.listening")}</span>
        </div>
      )}
      {micError && (
        <div className="border-t px-3 py-1.5 text-xs text-destructive shrink-0">
          {micError}
        </div>
      )}
      <div className="border-t p-2 flex gap-2 shrink-0">
        {!isSessionMode && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => isCompanion ? clearCompanion.mutate() : clearGeneral.mutate()}
            disabled={messages.length === 0 || clearGeneral.isPending || clearCompanion.isPending}
            title={t("chat.clearConversation")}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
        <Button
          size="sm"
          variant={voiceEnabled ? "default" : "outline"}
          onClick={() => setVoiceEnabled((v) => !v)}
          title={voiceEnabled ? t("chat.voiceOn") : t("chat.voiceOff")}
        >
          {voiceEnabled ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
        </Button>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t(isCompanion ? "chat.placeholderCompanion" : "chat.placeholder")}
          disabled={isPending}
          className="flex-1 text-sm"
        />
        <Button size="sm" onClick={handleSend} disabled={isPending || !inputValue.trim()}>
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}
