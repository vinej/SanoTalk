import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { LiveKitRoom, useChat, useRoomContext } from "@livekit/components-react";
import { trpc } from "../../lib/trpc";
import { ChatMessageInput } from "./chat-message-input";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { LogOut, UserPlus, Info } from "lucide-react";
import { useAvatarUrl, getInitials } from "../../lib/avatar-url";
import type { ReceivedChatMessage } from "@livekit/components-core";

interface FriendChatPanelProps {
  roomId: string;
  currentUserId: string;
  onLeft: () => void;
}

export function FriendChatPanel({ roomId, currentUserId, onLeft }: FriendChatPanelProps) {
  const { t } = useTranslation("chat");
  const { data: room } = trpc.friendChat.getRoom.useQuery({ roomId });
  const getToken = trpc.friendChat.getToken.useMutation();
  const leaveMutation = trpc.friendChat.leave.useMutation();
  const utils = trpc.useUtils();

  // Get LiveKit token
  const { data: tokenData } = trpc.friendChat.getToken.useMutation().isPending
    ? { data: undefined }
    : { data: undefined };

  // Use a ref to store token data and only fetch once
  const tokenRef = useRef<{ token: string; serverUrl: string } | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    getToken.mutateAsync({ roomId }).then((data) => {
      tokenRef.current = data;
    });
    return () => { fetchedRef.current = false; tokenRef.current = null; };
  }, [roomId]);

  async function handleLeave() {
    await leaveMutation.mutateAsync({ roomId });
    void utils.friendChat.list.invalidate();
    onLeft();
  }

  const roomName = room?.name
    || room?.participants
        .filter((p) => p.userId !== currentUserId)
        .map((p) => p.user.name)
        .join(", ")
    || t("title");

  if (!getToken.data) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>{t("connecting")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5 bg-card shrink-0">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold truncate">{roomName}</h2>
          <p className="text-xs text-muted-foreground">
            {room?.participants.length ?? 0} {t("participants")}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={handleLeave}>
            <LogOut className="h-3 w-3 mr-1" />
            {t("leave")}
          </Button>
        </div>
      </div>

      {/* Ephemeral notice */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-b text-xs text-amber-700 dark:text-amber-400">
        <Info className="h-3 w-3 shrink-0" />
        {t("ephemeralNotice")}
      </div>

      {/* LiveKit room */}
      <LiveKitRoom
        token={getToken.data.token}
        serverUrl={getToken.data.serverUrl}
        connect={true}
        video={false}
        audio={false}
        className="flex flex-col flex-1 min-h-0"
      >
        <ChatMessages currentUserId={currentUserId} roomId={roomId} />
      </LiveKitRoom>
    </div>
  );
}

/** Inner component rendered inside LiveKitRoom context. */
function ChatMessages({ currentUserId, roomId }: { currentUserId: string; roomId: string }) {
  const { t } = useTranslation("chat");
  const { chatMessages, send, isSending } = useChat();
  const heartbeat = trpc.friendChat.heartbeat.useMutation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  const handleSend = useCallback(async (message: string) => {
    await send(message);
    // Debounced heartbeat
    if (heartbeatTimer.current) clearTimeout(heartbeatTimer.current);
    heartbeatTimer.current = setTimeout(() => {
      heartbeat.mutate({ roomId });
    }, 5000);
  }, [send, roomId, heartbeat]);

  return (
    <>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {chatMessages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-8">{t("noMessages")}</p>
        )}
        {chatMessages.map((msg: ReceivedChatMessage, i: number) => {
          const isOwn = msg.from?.identity === currentUserId;
          return (
            <div key={msg.id ?? i} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${
                isOwn
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}>
                {!isOwn && (
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">
                    {msg.from?.name ?? "Unknown"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                <p className={`text-[10px] mt-0.5 ${isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <ChatMessageInput onSend={handleSend} disabled={isSending} />
    </>
  );
}
