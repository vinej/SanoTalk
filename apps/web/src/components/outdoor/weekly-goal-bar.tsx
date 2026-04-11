import { useTranslation } from "react-i18next";
import { Target } from "lucide-react";
import { trpc } from "../../lib/trpc";

export function WeeklyGoalBar() {
  const { t } = useTranslation("goOutside");
  const { data } = trpc.outdoor.weeklyGoal.useQuery();

  if (!data) return null;

  const { moderateEquivMins, goalMins, percentage } = data;
  const achieved = moderateEquivMins >= goalMins;

  // Color transitions: red (<50%) → amber (50-79%) → green (80%+) → celebratory (100%+)
  let barColor = "bg-red-500";
  let textColor = "text-red-700 dark:text-red-300";
  if (percentage >= 100) {
    barColor = "bg-green-500";
    textColor = "text-green-700 dark:text-green-300";
  } else if (percentage >= 80) {
    barColor = "bg-green-400";
    textColor = "text-green-700 dark:text-green-300";
  } else if (percentage >= 50) {
    barColor = "bg-amber-400";
    textColor = "text-amber-700 dark:text-amber-300";
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm font-medium">{t("weeklyGoal.title")}</span>
        </div>
        <span className={`text-sm font-bold ${textColor}`}>
          {t("weeklyGoal.percentage", { pct: percentage })}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t("weeklyGoal.progress", { current: moderateEquivMins, goal: goalMins })}</span>
        <span>{t("weeklyGoal.vigorousNote")}</span>
      </div>

      {achieved && (
        <p className="text-xs font-medium text-green-600 text-center">
          {t("weeklyGoal.achieved")}
        </p>
      )}
    </div>
  );
}
