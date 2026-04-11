import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";

const DAY_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekCalendar() {
  const { t } = useTranslation("trainBody");
  const { data: days } = trpc.workouts.weekSummary.useQuery();

  if (!days) return null;

  return (
    <div>
      <h3 className="text-sm font-medium mb-2">{t("progress.thisWeek")}</h3>
      <div className="flex gap-2 justify-center">
        {days.map((day) => {
          const d = new Date(day.date + "T12:00:00");
          const dayName = DAY_NAMES_EN[d.getDay()];
          const isToday = day.date === new Date().toISOString().slice(0, 10);
          return (
            <div key={day.date} className="flex flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{dayName}</span>
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  day.count > 0
                    ? "bg-lime-500 text-white"
                    : isToday
                      ? "border-2 border-lime-400 text-muted-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {day.count > 0 ? day.count : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
