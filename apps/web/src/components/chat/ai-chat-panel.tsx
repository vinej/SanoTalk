import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { trpc } from "../../lib/trpc";
import { Loader2, Send, Mic, MicOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

interface Props {
  sessionId: string;
  pendingVoiceText?: string;
  onVoiceTextConsumed?: () => void;
}

export function AiChatPanel({ sessionId, pendingVoiceText, onVoiceTextConsumed }: Props) {
  const { t } = useTranslation("sessions");
  const [inputValue, setInputValue] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], refetch } = trpc.agents.chatHistory.useQuery({ sessionId });
  const sendMutation = trpc.agents.sendChatMessage.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  // Auto-send voice transcript when voice mode is enabled
  useEffect(() => {
    if (voiceEnabled && pendingVoiceText && !sendMutation.isPending) {
      sendMutation.mutate({ sessionId, message: pendingVoiceText });
      onVoiceTextConsumed?.();
    }
  }, [pendingVoiceText, voiceEnabled]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, sendMutation.isPending]);

  function handleSend() {
    const trimmed = inputValue.trim();
    if (!trimmed || sendMutation.isPending) return;
    setInputValue("");
    sendMutation.mutate({ sessionId, message: trimmed });
  }

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {messages.length === 0 && !sendMutation.isPending && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("chat.empty")}
            </p>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                msg.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "mr-auto bg-muted text-foreground"
              )}
            >
              {msg.content}
            </div>
          ))}

          {sendMutation.isPending && (
            <div className="mr-auto bg-muted rounded-lg px-3 py-2">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {voiceEnabled && (
        <div className="border-t px-3 py-1.5 flex items-center gap-2 bg-red-500/10 shrink-0">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-600 font-medium">{t("chat.listening")}</span>
        </div>
      )}
      <div className="border-t p-2 flex gap-2 shrink-0">
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
          placeholder={t("chat.placeholder")}
          disabled={sendMutation.isPending}
          className="flex-1 text-sm"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={sendMutation.isPending || !inputValue.trim()}
        >
          {sendMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}
