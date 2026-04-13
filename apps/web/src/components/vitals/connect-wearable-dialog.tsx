import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectWearableDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation("vitals");
  const utils = trpc.useUtils();
  const [error, setError] = useState<string | null>(null);
  const openedAtRef = useRef<number | null>(null);

  const createSession = trpc.wearables.createConnectSession.useMutation({
    onSuccess: ({ url }) => {
      // Open Terra widget in a new tab — many vendor OAuth pages refuse iframe embed.
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) setError(t("connections.popupBlocked"));
    },
    onError: (err) => setError(err.message),
  });

  // Poll connection list while dialog is open. As soon as a NEW connection
  // (connectedAt > openedAt) appears, close the dialog automatically.
  useEffect(() => {
    if (!open) return;
    openedAtRef.current = Date.now();
    setError(null);

    const interval = setInterval(() => {
      void utils.wearables.listConnections.invalidate();
    }, 5000);
    return () => clearInterval(interval);
  }, [open, utils.wearables.listConnections]);

  const { data: connections } = trpc.wearables.listConnections.useQuery(undefined, {
    enabled: open,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!open || !openedAtRef.current || !connections) return;
    const fresh = connections.find((c) => new Date(c.connectedAt).getTime() > (openedAtRef.current ?? 0));
    if (fresh) onOpenChange(false);
  }, [connections, open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("connections.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("connections.dialogDesc")}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">{t("connections.dialogHelp")}</p>
          <Button
            onClick={() => createSession.mutate({})}
            disabled={createSession.isPending}
            className="w-full"
          >
            {createSession.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            {t("connections.openWidget")}
          </Button>
          {createSession.isSuccess && !error && (
            <p className="text-xs text-muted-foreground text-center">
              {t("connections.waitingForCallback")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
