import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (roomId: string) => void;
}

export function NewChatDialog({ open, onOpenChange, onCreated }: NewChatDialogProps) {
  const { t } = useTranslation("chat");
  const { data: friends = [] } = trpc.user.listFriends.useQuery(undefined, { enabled: open });
  const createRoom = trpc.friendChat.create.useMutation();
  const utils = trpc.useUtils();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [roomName, setRoomName] = useState("");

  function toggleFriend(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    const friendIds = Array.from(selected);
    if (friendIds.length === 0) return;

    const room = await createRoom.mutateAsync({
      friendIds,
      name: roomName.trim() || undefined,
    });
    void utils.friendChat.list.invalidate();
    setSelected(new Set());
    setRoomName("");
    onOpenChange(false);
    onCreated(room!.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newChat")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder={t("roomName")}
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={100}
          />

          <div className="space-y-1">
            <p className="text-sm font-medium">{t("selectFriends")}</p>
            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noFriends")}</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1">
                {friends.map((f: any) => (
                  <label
                    key={f.id}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(f.id)}
                      onChange={() => toggleFriend(f.id)}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    <span className="text-sm">{f.name}</span>
                    {f.role && (
                      <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 uppercase">
                        {f.role}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={selected.size === 0 || createRoom.isPending}
          >
            {t("startChat")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
