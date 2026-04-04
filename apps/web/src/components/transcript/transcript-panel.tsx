import { ScrollArea } from "../../components/ui/scroll-area";
import { trpc } from "../../lib/trpc";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";
import { useTranslation } from "react-i18next";

interface Props {
  sessionId: string;
}

export function TranscriptPanel({ sessionId }: Props) {
  const { t } = useTranslation("sessions");
  const { data: transcripts, isLoading } = trpc.transcripts.bySession.useQuery(
    { sessionId },
    { refetchInterval: (query) => (query.state.status === "error" ? false : 5000), retry: 1 }
  );

  return (
    <ScrollArea className="h-full rounded-lg border bg-card">
      <div className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t("transcript.title")}
        </h3>
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 bg-muted rounded animate-pulse" />
            ))}
          </div>
        )}
        {transcripts?.map((entry) => (
          <div key={entry.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {entry.speaker?.name ?? entry.speakerLabel ?? t("transcript.speaker")}
              </Badge>
              {entry.confidence != null && (
                <span
                  className={cn(
                    "text-xs",
                    entry.confidence > 0.85
                      ? "text-green-500"
                      : entry.confidence > 0.6
                        ? "text-yellow-500"
                        : "text-red-500"
                  )}
                >
                  {Math.round(entry.confidence * 100)}%
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed">{entry.content}</p>
          </div>
        ))}
        {!isLoading && !transcripts?.length && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t("transcript.empty")}
          </p>
        )}
      </div>
    </ScrollArea>
  );
}
