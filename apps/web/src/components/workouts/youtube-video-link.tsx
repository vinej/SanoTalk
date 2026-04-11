import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Play, WifiOff } from "lucide-react";
import type { Exercise } from "./exercise-catalog";

interface YouTubeVideoLinkProps {
  exercise: Exercise;
  exerciseName: string;
}

function buildYouTubeUrl(exercise: Exercise, exerciseName: string): string {
  if (exercise.youtubeId) {
    const url = `https://www.youtube.com/watch?v=${exercise.youtubeId}`;
    return exercise.youtubeStart ? `${url}&t=${exercise.youtubeStart}` : url;
  }
  const query = `${exerciseName} exercise seniors`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function YouTubeVideoLink({ exercise, exerciseName }: YouTubeVideoLinkProps) {
  const { t } = useTranslation("trainBody");
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const url = buildYouTubeUrl(exercise, exerciseName);

  if (!online) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-muted px-4 py-3 text-sm text-muted-foreground opacity-60">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>{t("exercise.videoOffline")}</span>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/40 transition-colors"
    >
      <Play className="h-4 w-4 shrink-0 fill-current" />
      <div className="min-w-0">
        <span>{t("exercise.watchVideos")}</span>
        <p className="text-xs font-normal text-muted-foreground">{t("exercise.watchVideosDesc")}</p>
      </div>
    </a>
  );
}
