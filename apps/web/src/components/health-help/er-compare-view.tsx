import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Loader2 } from "lucide-react";

function occupancyColor(rate: number | null): string {
  if (rate === null) return "bg-muted text-muted-foreground";
  if (rate < 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (rate < 120) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
}

interface Props {
  facilityNames: string[];
}

export function ErCompareView({ facilityNames }: Props) {
  const { t } = useTranslation("healthHelp");
  const { data = [], isLoading } = trpc.healthHelp.compareFacilities.useQuery(
    { facilityNames },
    { enabled: facilityNames.length > 0 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        {t("selectToCompare")}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((f) => (
        <div key={f.facilityName} className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold truncate">{f.facilityName}</h3>

          {/* Current */}
          {f.current ? (
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t("current")}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className={`rounded px-2 py-1 text-center ${occupancyColor(f.current.occupancyRate)}`}>
                  <div className="text-[10px] font-medium">{t("occupancyRate")}</div>
                  <div className="text-lg font-bold">{f.current.occupancyRate ?? "—"}%</div>
                </div>
                <div className="rounded px-2 py-1 text-center bg-muted">
                  <div className="text-[10px] font-medium text-muted-foreground">{t("patientsWaiting")}</div>
                  <div className="text-lg font-bold">{f.current.patientsWaiting}</div>
                </div>
                <div className="rounded px-2 py-1 text-center bg-muted">
                  <div className="text-[10px] font-medium text-muted-foreground">{t("avgWait")}</div>
                  <div className="text-lg font-bold">
                    {f.current.avgWaitHours > 0
                      ? t("avgWaitValue", { hours: f.current.avgWaitHours.toFixed(1) })
                      : "—"}
                  </div>
                </div>
                <div className="rounded px-2 py-1 text-center bg-muted">
                  <div className="text-[10px] font-medium text-muted-foreground">{t("stretcherCount")}</div>
                  <div className="text-lg font-bold">{f.current.stretchersOccupied}/{f.current.stretcherCount}</div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("noHistoryData")}</p>
          )}

          {/* 7-day averages */}
          {f.avg7d.occupancy != null && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{t("avg7d")}</p>
              <div className="flex gap-2 text-xs">
                <span className={`rounded px-2 py-0.5 ${occupancyColor(f.avg7d.occupancy)}`}>
                  {f.avg7d.occupancy}%
                </span>
                <span className="text-muted-foreground">
                  {f.avg7d.waitHours != null ? t("avgWaitValue", { hours: f.avg7d.waitHours.toFixed(1) }) : ""}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
