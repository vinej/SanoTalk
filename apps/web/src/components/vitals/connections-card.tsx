import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Watch, Plus, Loader2, X } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { ConnectWearableDialog } from "./connect-wearable-dialog";

type TFn = (key: string, opts?: { n?: number; time?: string; defaultValue?: string }) => string;

function relativeTime(date: Date | string | null | undefined, t: TFn): string {
  if (!date) return t("connections.never");
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return t("connections.justNow");
  if (min < 60) return t("connections.minAgo", { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("connections.hourAgo", { n: hr });
  const day = Math.floor(hr / 24);
  return t("connections.dayAgo", { n: day });
}

function providerKey(provider: string): "garmin" | "fitbit" | "google" | "other" {
  const p = provider.toLowerCase();
  if (p === "garmin") return "garmin";
  if (p === "fitbit") return "fitbit";
  if (p === "google") return "google";
  return "other";
}

export function ConnectionsCard() {
  const { t } = useTranslation("vitals");
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const { data: connections = [], isLoading } = trpc.wearables.listConnections.useQuery();
  const disconnectMutation = trpc.wearables.disconnect.useMutation({
    onSuccess: () => void utils.wearables.listConnections.invalidate(),
  });

  return (
    <div className="shrink-0 border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Watch className="h-3.5 w-3.5" />
          {t("connections.title")}
        </span>
        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setOpen(true)}>
          <Plus className="h-3 w-3 mr-1" />
          {t("connections.connect")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : connections.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6 px-3">
          {t("connections.none")}
        </p>
      ) : (
        <ul className="divide-y">
          {connections.map((c) => {
            const key = providerKey(c.provider);
            const statusKey = (c.status ?? "active") as "active" | "revoked" | "error";
            return (
              <li
                key={c.id}
                className="px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 min-w-0">
                  <span className="text-sm font-medium">
                    {t(`connections.provider.${key}`, { defaultValue: c.provider })}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {t("connections.lastSynced", { time: relativeTime(c.lastSyncedAt, t as TFn) })}
                  </span>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span
                    className={
                      "text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium " +
                      (statusKey === "active"
                        ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
                        : statusKey === "error"
                          ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                          : "bg-muted text-muted-foreground")
                    }
                  >
                    {t(`connections.status.${statusKey}`)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title={t("connections.disconnect")}
                    disabled={disconnectMutation.isPending}
                    onClick={() => disconnectMutation.mutate({ connectionId: c.id })}
                  >
                    {disconnectMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConnectWearableDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
