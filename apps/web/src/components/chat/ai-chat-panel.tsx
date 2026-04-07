import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { trpc } from "../../lib/trpc";
import { Loader2, Send, Mic, MicOff, Trash2, Bookmark, BookmarkCheck, BookmarkX, Volume2, VolumeX, Phone, MapPin, Stethoscope, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { cn } from "../../lib/utils";
import { useTranscriptSocket } from "../../hooks/use-transcript-socket";
import { useTts } from "../../hooks/use-tts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { useSession } from "../../lib/auth-client";

// ── Urgency triage badge ─────────────────────────────────────────────────────

type UrgencyLevel = "emergency" | "er_today" | "see_doctor" | "self_care";

const URGENCY_RE = /\[URGENCY:(emergency|er_today|see_doctor|self_care)\]/;

const URGENCY_CONFIG: Record<UrgencyLevel, { bg: string; border: string; text: string; icon: typeof Phone }> = {
  emergency:  { bg: "bg-red-50 dark:bg-red-950/40",    border: "border-red-300 dark:border-red-800",    text: "text-red-700 dark:text-red-300",    icon: Phone },
  er_today:   { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-300 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300", icon: MapPin },
  see_doctor: { bg: "bg-yellow-50 dark:bg-yellow-950/40", border: "border-yellow-300 dark:border-yellow-800", text: "text-yellow-700 dark:text-yellow-300", icon: Stethoscope },
  self_care:  { bg: "bg-green-50 dark:bg-green-950/40",  border: "border-green-300 dark:border-green-800",  text: "text-green-700 dark:text-green-300",  icon: Heart },
};

function UrgencyBadge({ level, t }: { level: UrgencyLevel; t: (key: string) => string }) {
  const cfg = URGENCY_CONFIG[level];
  const Icon = cfg.icon;
  return (
    <div className={cn("rounded-lg border p-3 my-2", cfg.bg, cfg.border)}>
      <div className={cn("flex items-center gap-2 font-semibold text-sm", cfg.text)}>
        <Icon className="h-4 w-4 shrink-0" />
        {t(`chat.urgency.${level}`)}
      </div>
      <p className={cn("text-xs mt-1", cfg.text, "opacity-80")}>
        {t(`chat.urgency.${level}Desc`)}
      </p>
      {(level === "emergency" || level === "er_today") && (
        <div className="flex gap-2 mt-2">
          {level === "emergency" && (
            <a href="tel:911" className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-300 underline">
              <Phone className="h-3 w-3" /> 911
            </a>
          )}
          <Link to="/health-help" className="inline-flex items-center gap-1 text-xs font-medium underline" style={{ color: "inherit" }}>
            <MapPin className="h-3 w-3" /> {t("chat.urgency.findER")}
          </Link>
        </div>
      )}
      {level === "see_doctor" && (
        <a href="tel:811" className={cn("inline-flex items-center gap-1 text-xs font-medium mt-2 underline", cfg.text)}>
          <Phone className="h-3 w-3" /> 811 — Info-Santé
        </a>
      )}
    </div>
  );
}

function renderMessageContent(content: string, t: (key: string) => string) {
  const match = content.match(URGENCY_RE);
  if (!match) return <>{content}</>;

  const level = match[1] as UrgencyLevel;
  const textWithoutTag = content.replace(URGENCY_RE, "").trim();
  return (
    <>
      {textWithoutTag}
      <UrgencyBadge level={level} t={t} />
    </>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  sessionId?: string;
  variant?: "health" | "companion" | "news";
  pendingVoiceText?: string;
  onVoiceTextConsumed?: () => void;
}

export function AiChatPanel({ sessionId, variant = "health", pendingVoiceText, onVoiceTextConsumed }: Props) {
  const { t, i18n } = useTranslation("sessions");
  const { data: sessionData } = useSession();
  const userId = sessionData?.user?.id;

  const isSessionMode = !!sessionId;
  const isCompanion = !isSessionMode && variant === "companion";
  const isNews = !isSessionMode && variant === "news";
  const chatTypeArg = isCompanion ? "companion" : isNews ? "news" : "health";
  const titleStorageKey = userId
    ? `sanotalk_chat_loaded_title_${chatTypeArg}_${userId}`
    : null;

  const [inputValue, setInputValue] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showSaveNowDialog, setShowSaveNowDialog] = useState(false);
  const [loadedConversationTitle, setLoadedConversationTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!titleStorageKey) return;
    try { setLoadedConversationTitle(localStorage.getItem(titleStorageKey)); } catch { /* ignore */ }
  }, [titleStorageKey]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const ttsStorageKey = `sanotalk_chat_tts_${chatTypeArg}`;
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    try { return localStorage.getItem(ttsStorageKey) === "true"; } catch { return false; }
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: sessionMessages = [], refetch: refetchSession } = trpc.agents.chatHistory.useQuery(
    { sessionId: sessionId! },
    { enabled: isSessionMode }
  );
  const { data: healthMessages = [], refetch: refetchHealth } = trpc.agents.healthChatHistory.useQuery(
    undefined,
    { enabled: !isSessionMode && !isCompanion && !isNews }
  );
  const { data: companionMessages = [], refetch: refetchCompanion } = trpc.agents.companionChatHistory.useQuery(
    undefined,
    { enabled: isCompanion }
  );
  const { data: newsMessages = [], refetch: refetchNews } = trpc.agents.newsChatHistory.useQuery(
    undefined,
    { enabled: isNews }
  );

  const messages = isSessionMode ? sessionMessages : isCompanion ? companionMessages : isNews ? newsMessages : healthMessages;
  const refetch = isSessionMode ? refetchSession : isCompanion ? refetchCompanion : isNews ? refetchNews : refetchHealth;

  // ── Saved conversations ────────────────────────────────────────────────────
  const { data: savedList = [], refetch: refetchSaved } = trpc.agents.listSavedConversations.useQuery(
    { chatType: chatTypeArg },
    { enabled: !isSessionMode }
  );
  const saveConversationMutation = trpc.agents.saveConversation.useMutation({
    onSuccess: () => { void refetchSaved(); },
  });
  const loadSavedMutation = trpc.agents.loadSavedConversation.useMutation({
    onSuccess: () => { void refetch(); setShowSavedPanel(false); },
  });

  function persistLoadedTitle(title: string | null) {
    setLoadedConversationTitle(title);
    if (!titleStorageKey) return;
    try {
      if (title) localStorage.setItem(titleStorageKey, title);
      else localStorage.removeItem(titleStorageKey);
    } catch { /* ignore */ }
  }

  function handleLoadSaved(id: string, title: string) {
    loadSavedMutation.mutate({ savedId: id }, {
      onSuccess: () => persistLoadedTitle(title),
    });
  }
  const deleteSavedMutation = trpc.agents.deleteSavedConversation.useMutation({
    onSuccess: () => { void refetchSaved(); },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const sendSessionMessage = trpc.agents.sendChatMessage.useMutation({ onSuccess: () => { void refetch(); } });
  const sendHealthMessage = trpc.agents.sendHealthChatMessage.useMutation({ onSuccess: () => { void refetch(); } });
  const sendCompanionMessage = trpc.agents.sendCompanionChatMessage.useMutation({ onSuccess: () => { void refetch(); } });
  const sendNewsMessage = trpc.agents.sendNewsChatMessage.useMutation({ onSuccess: () => { void refetch(); } });
  const clearHealth = trpc.agents.clearHealthChat.useMutation({ onSuccess: () => { void refetch(); } });
  const clearCompanion = trpc.agents.clearCompanionChat.useMutation({ onSuccess: () => { void refetch(); } });
  const clearNews = trpc.agents.clearNewsChat.useMutation({ onSuccess: () => { void refetch(); } });

  const isPending = isSessionMode
    ? sendSessionMessage.isPending
    : isCompanion
      ? sendCompanionMessage.isPending
      : isNews
        ? sendNewsMessage.isPending
        : sendHealthMessage.isPending;

  // ── Voice (non-session modes) ──────────────────────────────────────────────
  const { isRecording, micError } = useTranscriptSocket(undefined, {
    enabled: !isSessionMode && voiceEnabled && !!sessionData?.session?.token,
    language: i18n.language,
    onFinalTranscript: (text) => {
      if (isCompanion) {
        sendCompanionMessage.mutate({ message: text, language: i18n.language });
      } else if (isNews) {
        sendNewsMessage.mutate({ message: text, language: i18n.language });
      } else {
        sendHealthMessage.mutate({ message: text, language: i18n.language });
      }
    },
  });

  // ── TTS ────────────────────────────────────────────────────────────────────
  const { speak, stop: stopTts, isSpeaking, isSupported: ttsSupported } = useTts();

  function toggleTts() {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    try { localStorage.setItem(ttsStorageKey, String(next)); } catch { /* ignore */ }
    if (!next) stopTts();
  }

  useEffect(() => {
    if (!ttsEnabled || messages.length === 0) {
      prevMsgCountRef.current = messages.length;
      return;
    }
    if (messages.length > prevMsgCountRef.current) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") speak(last.content, i18n.language);
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  // ── Send ───────────────────────────────────────────────────────────────────
  function handleSend() {
    const trimmed = inputValue.trim();
    if (!trimmed || isPending) return;
    setInputValue("");
    if (isSessionMode) {
      sendSessionMessage.mutate({ sessionId: sessionId!, message: trimmed });
    } else if (isCompanion) {
      sendCompanionMessage.mutate({ message: trimmed, language: i18n.language });
    } else if (isNews) {
      sendNewsMessage.mutate({ message: trimmed, language: i18n.language });
    } else {
      sendHealthMessage.mutate({ message: trimmed, language: i18n.language });
    }
  }

  function handleClearConfirmed() {
    stopTts();
    (isCompanion ? clearCompanion : isNews ? clearNews : clearHealth).mutate(undefined, {
      onSuccess: () => {
        setShowClearDialog(false);
        setShowSaveInput(false);
        setSaveTitle("");
        persistLoadedTitle(null);
      },
    });
  }

  function handleSaveAndClear() {
    saveConversationMutation.mutate(
      { chatType: chatTypeArg, title: saveTitle.trim() },
      { onSuccess: () => { handleClearConfirmed(); } }
    );
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
          isCompanion ? "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300"
          : isNews ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
          : "bg-muted/50 text-foreground"
        )}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0">{t(isCompanion ? "chat.titleCompanion" : isNews ? "chat.titleNews" : "chat.titleGeneral")}</span>
            {loadedConversationTitle && (
              <>
                <span className="shrink-0 opacity-40">·</span>
                <span className="truncate font-normal opacity-70">{loadedConversationTitle}</span>
              </>
            )}
          </div>
        </div>
      )}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {messages.length === 0 && !isPending && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t(isCompanion ? "chat.emptyCompanion" : isNews ? "chat.emptyNews" : "chat.empty")}
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
                    : isNews
                      ? "mr-auto bg-amber-50 dark:bg-amber-950/30 text-foreground"
                      : "mr-auto bg-muted text-foreground"
              )}
            >
              {msg.role === "assistant" ? renderMessageContent(msg.content, t) : msg.content}
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

      {/* Saved conversations panel */}
      {!isSessionMode && showSavedPanel && (
        <div className="border-t shrink-0">
          <div className="px-3 pt-2 pb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {t("chat.saved.panelTitle")}
            </span>
          </div>
          <ScrollArea className="max-h-44">
            <div className="px-3 pb-2 space-y-1">
              {savedList.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 text-center italic">
                  {t("chat.saved.empty")}
                </p>
              )}
              {savedList.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleLoadSaved(item.id, item.title)}
                  title={t("chat.saved.load")}
                >
                  <span className="flex-1 text-sm truncate">{item.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    title={t("chat.saved.load")}
                    disabled={loadSavedMutation.isPending}
                    onClick={(e) => { e.stopPropagation(); handleLoadSaved(item.id, item.title); }}
                  >
                    <BookmarkCheck className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    title={t("chat.saved.delete")}
                    disabled={deleteSavedMutation.isPending}
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: item.id, title: item.title }); }}
                  >
                    <BookmarkX className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {isSpeaking && (
        <div className="border-t px-3 py-1.5 flex items-center gap-2 bg-sky-500/10 shrink-0">
          <span className="inline-block w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
          <span className="text-xs text-sky-600 font-medium">{t("chat.speaking")}</span>
        </div>
      )}
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
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setSaveTitle(loadedConversationTitle ?? ""); setShowClearDialog(true); }}
              disabled={messages.length === 0 || clearHealth.isPending || clearCompanion.isPending}
              title={t("chat.clearConversation")}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={showSavedPanel ? "secondary" : "ghost"}
              onClick={() => setShowSavedPanel((v) => !v)}
              title={t("chat.saved.toggle")}
              className="text-muted-foreground"
            >
              <Bookmark className="h-3 w-3" />
            </Button>
            {messages.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                disabled={saveConversationMutation.isPending}
                title={t("chat.saved.saveNow")}
                className="text-muted-foreground"
                onClick={() => { setSaveTitle(loadedConversationTitle ?? ""); setShowSaveNowDialog(true); }}
              >
                {saveConversationMutation.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <BookmarkCheck className="h-3 w-3" />}
              </Button>
            )}
          </>
        )}
        {ttsSupported && !isSessionMode && (
          <Button
            size="sm"
            variant={ttsEnabled ? "default" : "outline"}
            onClick={toggleTts}
            title={ttsEnabled ? t("chat.ttsOn") : t("chat.ttsOff")}
          >
            {ttsEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
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
          placeholder={t(isCompanion ? "chat.placeholderCompanion" : isNews ? "chat.placeholderNews" : "chat.placeholder")}
          disabled={isPending}
          className="flex-1 text-sm"
        />
        <Button size="sm" onClick={handleSend} disabled={isPending || !inputValue.trim()}>
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
        </Button>
      </div>

      {/* Delete saved conversation confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chat.saved.deleteDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("chat.saved.deleteDialog.desc", { title: deleteTarget?.title ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              {t("chat.saved.deleteDialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteSavedMutation.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteSavedMutation.mutate({ savedId: deleteTarget.id }, {
                  onSuccess: () => setDeleteTarget(null),
                });
              }}
            >
              {deleteSavedMutation.isPending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : t("chat.saved.deleteDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear dialog */}
      <Dialog
        open={showClearDialog}
        onOpenChange={(open) => {
          if (!open) { setShowSaveInput(false); setSaveTitle(""); }
          setShowClearDialog(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chat.clearDialog.title")}</DialogTitle>
            <DialogDescription>{t("chat.clearDialog.desc")}</DialogDescription>
          </DialogHeader>

          {showSaveInput && (
            <div className="flex flex-col gap-2 pt-1">
              <Label htmlFor="save-title" className="text-sm">{t("chat.clearDialog.titleLabel")}</Label>
              <Input
                id="save-title"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder={t("chat.clearDialog.titlePlaceholder")}
                className="text-sm"
                onKeyDown={(e) => { if (e.key === "Enter" && saveTitle.trim()) handleSaveAndClear(); }}
                autoFocus
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowSaveInput(false); setSaveTitle(""); setShowClearDialog(false); }}
            >
              {t("chat.clearDialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={clearHealth.isPending || clearCompanion.isPending}
              onClick={handleClearConfirmed}
            >
              {t("chat.clearDialog.clearOnly")}
            </Button>
            {!showSaveInput ? (
              <Button size="sm" onClick={() => setShowSaveInput(true)}>
                {t("chat.clearDialog.saveFirst")}
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={!saveTitle.trim() || saveConversationMutation.isPending || clearHealth.isPending || clearCompanion.isPending}
                onClick={handleSaveAndClear}
              >
                {saveConversationMutation.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : t("chat.clearDialog.saveAndClear")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save now dialog */}
      <Dialog open={showSaveNowDialog} onOpenChange={(open) => { if (!open) { setShowSaveNowDialog(false); setSaveTitle(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("chat.saved.saveNow")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-1">
            <Label htmlFor="save-now-title" className="text-sm">{t("chat.clearDialog.titleLabel")}</Label>
            <Input
              id="save-now-title"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              placeholder={t("chat.clearDialog.titlePlaceholder")}
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && saveTitle.trim()) {
                  saveConversationMutation.mutate(
                    { chatType: chatTypeArg, title: saveTitle.trim() },
                    { onSuccess: () => { persistLoadedTitle(saveTitle.trim()); setShowSaveNowDialog(false); setSaveTitle(""); } }
                  );
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowSaveNowDialog(false); setSaveTitle(""); }}>
              {t("chat.clearDialog.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!saveTitle.trim() || saveConversationMutation.isPending}
              onClick={() => {
                saveConversationMutation.mutate(
                  { chatType: chatTypeArg, title: saveTitle.trim() },
                  { onSuccess: () => { persistLoadedTitle(saveTitle.trim()); setShowSaveNowDialog(false); setSaveTitle(""); } }
                );
              }}
            >
              {saveConversationMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("chat.saved.saveNow")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
