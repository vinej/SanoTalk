import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface Props {
  facilityName: string;
}

function cellColor(val: number | null): string {
  if (val === null) return "bg-muted";
  if (val < 60) return "bg-green-200 dark:bg-green-900";
  if (val < 80) return "bg-green-100 dark:bg-green-950/50";
  if (val < 100) return "bg-yellow-100 dark:bg-yellow-900/50";
  if (val < 120) return "bg-yellow-200 dark:bg-yellow-900";
  if (val < 150) return "bg-orange-200 dark:bg-orange-900";
  return "bg-red-200 dark:bg-red-900";
}

const DAYS = ["daySun", "dayMon", "dayTue", "dayWed", "dayThu", "dayFri", "daySat"] as const;

export function BestTimeHeatmap({ facilityName }: Props) {
  const { t } = useTranslation("healthHelp");
  const { data: grid, isLoading } = trpc.healthHelp.bestTimeToVisit.useQuery(
    { facilityName },
    { enabled: !!facilityName }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!grid || grid.every((row) => row.every((v) => v === null))) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        {t("noHistoryData")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="w-12"></th>
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} className="text-[9px] text-muted-foreground font-normal w-6 text-center">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((dayKey, dow) => (
              <tr key={dayKey}>
                <td className="text-[10px] text-muted-foreground font-medium pr-1 text-right whitespace-nowrap">
                  {t(dayKey)}
                </td>
                {Array.from({ length: 24 }, (_, h) => {
                  const val = grid[dow]?.[h] ?? null;
                  return (
                    <td
                      key={h}
                      className={cn("w-6 h-5 rounded-sm text-center", cellColor(val))}
                      title={val != null ? `${val}%` : t("noData")}
                    >
                      <span className="text-[8px] font-mono opacity-70">
                        {val != null ? val : ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{t("occupancyLow")}</span>
        <div className="flex gap-0.5">
          <div className="w-4 h-3 rounded-sm bg-green-200 dark:bg-green-900" />
          <div className="w-4 h-3 rounded-sm bg-yellow-100 dark:bg-yellow-900/50" />
          <div className="w-4 h-3 rounded-sm bg-yellow-200 dark:bg-yellow-900" />
          <div className="w-4 h-3 rounded-sm bg-orange-200 dark:bg-orange-900" />
          <div className="w-4 h-3 rounded-sm bg-red-200 dark:bg-red-900" />
        </div>
        <span>{t("occupancyHigh")}</span>
      </div>

      <p className="text-[10px] text-muted-foreground">{t("bestTimeDesc")}</p>
    </div>
  );
}
