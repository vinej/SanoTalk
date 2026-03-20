import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  sessionId: string;
}

export function SummaryPanel({ sessionId }: Props) {
  const { data: summary, refetch } =
    trpc.transcripts.summaryBySession.useQuery({ sessionId });

  const generateMutation = trpc.agents.generateSummary.useMutation({
    onSuccess: () => {
      // Poll for completion
      const interval = setInterval(() => {
        void refetch().then((r) => {
          if (r.data) clearInterval(interval);
        });
      }, 2000);
    },
  });

  return (
    <ScrollArea className="h-full rounded-lg border bg-card">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            AI Summary
          </h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateMutation.mutate({ sessionId })}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-3 w-3" />
            )}
            Generate
          </Button>
        </div>

        {summary ? (
          <div className="space-y-4">
            <section>
              <h4 className="font-medium text-sm mb-1">Summary</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {summary.summary}
              </p>
            </section>

            {summary.keyPoints && summary.keyPoints.length > 0 && (
              <section>
                <h4 className="font-medium text-sm mb-2">Key Points</h4>
                <ul className="space-y-1">
                  {summary.keyPoints.map((pt, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-primary mt-0.5">•</span>
                      <span className="text-muted-foreground">{pt}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {summary.soapNote && (
              <section>
                <h4 className="font-medium text-sm mb-2">SOAP Note</h4>
                <div className="space-y-2">
                  {(
                    [
                      ["S", "subjective"],
                      ["O", "objective"],
                      ["A", "assessment"],
                      ["P", "plan"],
                    ] as const
                  ).map(([label, key]) => (
                    <div key={key} className="flex gap-2 text-sm">
                      <Badge className="shrink-0 w-6 h-6 text-xs flex items-center justify-center">
                        {label}
                      </Badge>
                      <span className="text-muted-foreground">
                        {summary.soapNote?.[key]}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Click <strong>Generate</strong> to create an AI summary after the
            session.
          </p>
        )}
      </div>
    </ScrollArea>
  );
}
