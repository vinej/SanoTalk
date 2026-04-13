import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { Plus, MessageCircle } from "lucide-react";
import { NewChatDialog } from "./new-chat-dialog";
import { cn } from "../../lib/utils";

interface FriendChatRoomListProps {
  currentUserId: string;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
}

export function FriendChatRoomList({ currentUserId, selectedRoomId, onSelectRoom }: FriendChatRoomListProps) {
  const { t } = useTranslation("chat");
  const { data: rooms = [] } = trpc.friendChat.list.useQuery(undefined, { refetchInterval: 30_000 });
  const [dialogOpen, setDialogOpen] = useState(false);

  const seenRoomIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!rooms) return;
    const currentIds = new Set(rooms.map((r: any) => r.id));
    if (seenRoomIdsRef.current === null) {
      seenRoomIdsRef.current = currentIds;
      return;
    }
    const seen = seenRoomIdsRef.current;
    for (const room of rooms) {
      if (seen.has(room.id)) continue;
      if (room.createdById === currentUserId) continue;
      if (room.id === selectedRoomId) continue;
      const creator = (room.participants ?? []).find((p: any) => p.userId === room.createdById);
      const creatorName = creator?.user?.name ?? t("someone");
      toast(t("invitedToChat", { name: creatorName }), {
        action: {
          label: t("join"),
          onClick: () => onSelectRoom(room.id),
        },
      });
    }
    seenRoomIdsRef.current = currentIds;
  }, [rooms, currentUserId, selectedRoomId, onSelectRoom, t]);

  function getRoomDisplayName(room: any) {
    if (room.name) return room.name;
    const others = room.participants
      .filter((p: any) => p.userId !== currentUserId)
      .map((p: any) => p.user.name);
    return others.length > 0 ? others.join(", ") : t("title");
  }

  function formatTime(date: Date) {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  return (
    <div className="flex flex-col h-full border-r bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <MessageCircle className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">{t("noRooms")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("noRoomsHint")}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />
              {t("newChat")}
            </Button>
          </div>
        ) : (
          rooms.map((room: any) => (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={cn(
                "w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors",
                selectedRoomId === room.id && "bg-muted",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium truncate pr-2">{getRoomDisplayName(room)}</p>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatTime(room.lastActivityAt)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {room.participants.length} {t("participants")}
              </p>
            </button>
          ))
        )}
      </div>

      <NewChatDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(roomId) => onSelectRoom(roomId)}
      />
    </div>
  );
}
