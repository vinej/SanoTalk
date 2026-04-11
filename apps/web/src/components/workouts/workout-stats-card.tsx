import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Flame, Trophy, Clock, Dumbbell } from "lucide-react";
import { trpc } from "../../lib/trpc";

export function WorkoutStatsCard() {
  const { t } = useTranslation("trainBody");

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 90);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const { data: stats } = trpc.workouts.stats.useQuery(range);

  if (!stats) return null;

  const items = [
    { icon: Flame, label: t("progress.streak"), value: t("progress.streakDays", { count: stats.currentStreak }) },
    { icon: Trophy, label: t("progress.longestStreak"), value: t("progress.streakDays", { count: stats.longestStreak }) },
    { icon: Dumbbell, label: t("progress.totalWorkouts"), value: String(stats.totalWorkouts) },
    { icon: Clock, label: t("progress.totalDuration"), value: t("progress.minutes", { count: Math.round(stats.totalDurationSecs / 60) }) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border bg-card p-3 flex items-center gap-3">
          <item.icon className="h-5 w-5 text-lime-600 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-semibold">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
