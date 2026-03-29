import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { trpc } from "../../lib/trpc";
import { Loader2, Send, Mic, MicOff, Trash2, Bookmark, BookmarkCheck, BookmarkX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { useTranscriptSocket } from "../../hooks/use-transcript-socket";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";

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
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [loadedConversationTitle, setLoadedConversationTitle] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isSessionMode = !!sessionId;
  const isCompanion = !isSessionMode && variant === "companion";
  const chatTypeArg = isCompanion ? "companion" : "general";

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

  function handleLoadSaved(id: string, title: string) {
    loadSavedMutation.mutate({ savedId: id }, {
      onSuccess: () => setLoadedConversationTitle(title),
    });
  }
  const deleteSavedMutation = trpc.agents.deleteSavedConversation.useMutation({
    onSuccess: () => { void refetchSaved(); },
  });

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

  function handleClearConfirmed() {
    (isCompanion ? clearCompanion : clearGeneral).mutate(undefined, {
      onSuccess: () => {
        setShowClearDialog(false);
        setShowSaveInput(false);
        setSaveTitle("");
        setLoadedConversationTitle(null);
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
          isCompanion ? "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300" : "bg-muted/50 text-foreground"
        )}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="shrink-0">{t(isCompanion ? "chat.titleCompanion" : "chat.titleGeneral")}</span>
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
                <div key={item.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
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
                    onClick={() => handleLoadSaved(item.id, item.title)}
                  >
                    <BookmarkCheck className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    title={t("chat.saved.delete")}
                    disabled={deleteSavedMutation.isPending}
                    onClick={() => setDeleteTarget({ id: item.id, title: item.title })}
                  >
                    <BookmarkX className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
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
              disabled={messages.length === 0 || clearGeneral.isPending || clearCompanion.isPending}
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
                onClick={() => {
                  const title = window.prompt(t("chat.saved.titlePrompt"), loadedConversationTitle ?? "");
                  if (title?.trim()) {
                    saveConversationMutation.mutate({ chatType: chatTypeArg, title: title.trim() });
                  }
                }}
              >
                {saveConversationMutation.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <BookmarkCheck className="h-3 w-3" />}
              </Button>
            )}
          </>
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
              disabled={clearGeneral.isPending || clearCompanion.isPending}
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
                disabled={!saveTitle.trim() || saveConversationMutation.isPending || clearGeneral.isPending || clearCompanion.isPending}
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
    </div>
  );
}
