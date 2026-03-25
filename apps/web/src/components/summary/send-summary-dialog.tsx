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

type RecipientType = "doctor" | "pharmacist";

type Props = {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SendSummaryDialog({ sessionId, open, onOpenChange }: Props) {
  const { t } = useTranslation("sessions");
  const [selected, setSelected] = useState<RecipientType | null>(null);
  const [sent, setSent] = useState(false);

  const { data: profile } = trpc.user.profile.useQuery(undefined, { enabled: open });
  const linkedDoctor = (profile as any)?.linkedDoctor as { name: string; email: string; specialty?: string | null } | null | undefined;
  const linkedPharmacist = (profile as any)?.linkedPharmacist as { name: string; email: string; specialty?: string | null } | null | undefined;
  const hasRecipients = !!linkedDoctor || !!linkedPharmacist;

  const sendMutation = trpc.agents.sendSummary.useMutation({
    onSuccess: () => {
      setSent(true);
      setTimeout(() => {
        setSent(false);
        setSelected(null);
        onOpenChange(false);
      }, 1500);
    },
  });

  function handleSend() {
    if (!selected) return;
    sendMutation.mutate({ sessionId, recipientType: selected });
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setSelected(null);
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
            <>
              {linkedDoctor && (
                <button
                  type="button"
                  onClick={() => setSelected("doctor")}
                  className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors ${
                    selected === "doctor"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-medium">{linkedDoctor.name}</div>
                  {linkedDoctor.specialty && (
                    <div className="text-muted-foreground text-xs">{linkedDoctor.specialty}</div>
                  )}
                  <div className="text-muted-foreground text-xs">{linkedDoctor.email}</div>
                </button>
              )}
              {linkedPharmacist && (
                <button
                  type="button"
                  onClick={() => setSelected("pharmacist")}
                  className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors ${
                    selected === "pharmacist"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-medium">{linkedPharmacist.name}</div>
                  {linkedPharmacist.specialty && (
                    <div className="text-muted-foreground text-xs">{linkedPharmacist.specialty}</div>
                  )}
                  <div className="text-muted-foreground text-xs">{linkedPharmacist.email}</div>
                </button>
              )}
            </>
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
            disabled={!selected || isPending || sent || !hasRecipients}
          >
            <Send className="mr-1 h-3 w-3" />
            {sent ? t("summary.sent") : isPending ? t("summary.sending") : t("summary.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
