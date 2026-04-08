import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Send } from "lucide-react";

type Props = {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SendSummaryDialog({ sessionId, open, onOpenChange }: Props) {
  const { t } = useTranslation("sessions");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const { data: linkedUsers = [] } = trpc.user.listLinkedUsers.useQuery(undefined, { enabled: open });
  const hasRecipients = linkedUsers.length > 0;

  const utils = trpc.useUtils();
  const sendMutation = trpc.agents.sendSummary.useMutation({
    onSuccess: () => {
      void utils.tasks.list.invalidate();
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setSelectedId(null);
        onOpenChange(false);
      }, 1500);
    },
  });

  function handleSend() {
    if (!selectedId) return;
    sendMutation.mutate({ sessionId, recipientUserId: selectedId });
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setSelectedId(null);
      setSent(false);
    }
    onOpenChange(v);
  }

  const isPending = sendMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("summary.sendTitle")}</DialogTitle>
          <DialogDescription>{t("summary.sendDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {hasRecipients ? (
            linkedUsers.map((u) => (
              <button
                key={u?.id}
                type="button"
                onClick={() => setSelectedId(u?.id ?? null)}
                className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors ${
                  selectedId === u?.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium">{u?.name}</div>
                {(u as any)?.specialty && (
                  <div className="text-muted-foreground text-xs">{(u as any).specialty}</div>
                )}
                <div className="text-muted-foreground text-xs capitalize">{(u as any)?.role}</div>
              </button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("summary.noRecipients")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedId || isPending || sent || !hasRecipients}
          >
            <Send className="mr-1 h-3 w-3" />
            {sent ? t("summary.sent") : isPending ? t("summary.sending") : t("summary.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
