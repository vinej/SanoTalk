import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Clock, AlertTriangle, Play, WifiOff } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import type { OutdoorActivity } from "./activity-catalog";
import { INTENSITY_COLORS } from "./activity-catalog";

interface ActivityDetailDialogProps {
  activity: OutdoorActivity | null;
  name: string;
  description: string;
  tips: string[];
  safetyTip: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogActivity: (activity: OutdoorActivity) => void;
}

export function ActivityDetailDialog({
  activity,
  name,
  description,
  tips,
  safetyTip,
  open,
  onOpenChange,
  onLogActivity,
}: ActivityDetailDialogProps) {
  const { t } = useTranslation("goOutside");
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => { window.removeEventListener("online", onOn); window.removeEventListener("offline", onOff); };
  }, []);

  if (!activity) return null;

  const searchQuery = `${name} exercise seniors`;
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={INTENSITY_COLORS[activity.intensity]}>
            {t(`intensity.${activity.intensity}`)}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {t("activity.duration", { mins: activity.suggestedMins })}
          </span>
        </div>

        {online ? (
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
          >
            <Play className="h-4 w-4 shrink-0 fill-current" />
            <div className="min-w-0">
              <span>{t("activity.watchVideos")}</span>
              <p className="text-xs font-normal text-muted-foreground">{t("activity.watchVideosDesc")}</p>
            </div>
          </a>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-muted px-4 py-3 text-sm text-muted-foreground opacity-60">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>{t("activity.videoOffline")}</span>
          </div>
        )}

        {tips.length > 0 && (
          <ul className="mt-4 space-y-2 pl-5 list-disc text-sm">
            {tips.map((tip, i) => (
              <li key={i} className="text-muted-foreground leading-relaxed">{tip}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">{safetyTip}</p>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("log.cancel")}
          </Button>
          <Button size="sm" onClick={() => onLogActivity(activity)}>
            {t("activity.logActivity")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
