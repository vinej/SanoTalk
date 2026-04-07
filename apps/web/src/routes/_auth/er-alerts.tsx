import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { ArrowLeft, Star, Loader2 } from "lucide-react";
import { ErHistoryChart } from "../../components/health-help/er-history-chart";
import { ErCompareView } from "../../components/health-help/er-compare-view";
import { BestTimeHeatmap } from "../../components/health-help/best-time-heatmap";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/_auth/er-alerts")({
  component: ErAlertsPage,
});

type HistoryRange = "24h" | "7d" | "30d";

function ErAlertsPage() {
  const { t } = useTranslation("healthHelp");
  const { data: favorites = [], isLoading } = trpc.healthHelp.listFavorites.useQuery();

  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [historyRange, setHistoryRange] = useState<HistoryRange>("24h");
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<Set<string>>(new Set());

  // Auto-select first favorite
  const activeFacility = selectedFacility ?? favorites[0] ?? null;

  function toggleCompareItem(name: string) {
    setCompareSelection((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else if (next.size < 5) next.add(name);
      return next;
    });
  }

  const compareNames = useMemo(() => Array.from(compareSelection), [compareSelection]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 px-6 py-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link to="/health-help"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("erAlertsTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("erAlertsDesc")}</p>
        </div>
      </div>

      {/* Empty state */}
      {favorites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Star className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">{t("noFavorites")}</p>
          <p className="text-sm text-muted-foreground text-center max-w-sm">{t("noFavoritesDesc")}</p>
          <Button variant="outline" asChild>
            <Link to="/health-help">{t("goToHealthHelp")}</Link>
          </Button>
        </div>
      )}

      {favorites.length > 0 && (
        <>
          {/* Favorite selector */}
          <div className="space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("favorites")}</h2>
              <Button
                size="sm"
                variant={compareMode ? "default" : "outline"}
                onClick={() => { setCompareMode(!compareMode); setCompareSelection(new Set()); }}
              >
                {t("compare")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {favorites.map((name) => {
                const isActive = compareMode ? compareSelection.has(name) : activeFacility === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      if (compareMode) {
                        toggleCompareItem(name);
                      } else {
                        setSelectedFacility(name);
                      }
                    }}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg border transition-colors truncate max-w-[250px]",
                      isActive
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "text-foreground hover:bg-muted border-border"
                    )}
                  >
                    <Star className={cn("inline h-3 w-3 mr-1", isActive ? "fill-current" : "")} />
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compare view */}
          {compareMode && compareNames.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("compareTitle")}</h2>
              <ErCompareView facilityNames={compareNames} />
            </div>
          )}

          {/* History chart */}
          {!compareMode && activeFacility && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("occupancyTrend")}</h2>
                <div className="flex gap-1">
                  {(["24h", "7d", "30d"] as HistoryRange[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setHistoryRange(r)}
                      className={cn(
                        "px-2 py-0.5 text-xs rounded transition-colors",
                        historyRange === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {t(`range${r.toUpperCase()}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <ErHistoryChart facilityName={activeFacility} range={historyRange} />
              </div>
            </div>
          )}

          {/* Best time to visit */}
          {!compareMode && activeFacility && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t("bestTimeToVisit")}</h2>
              <div className="border rounded-lg p-3">
                <BestTimeHeatmap facilityName={activeFacility} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
