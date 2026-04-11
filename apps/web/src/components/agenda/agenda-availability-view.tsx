import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Pencil } from "lucide-react";
import { Button } from "../ui/button";
import { trpc } from "../../lib/trpc";
import { EditAvailabilityDialog } from "./edit-availability-dialog";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function AgendaAvailabilityView() {
  const { t } = useTranslation("agenda");
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { data: slots, isLoading } = trpc.agenda.getMyAvailability.useQuery(undefined, {
    retry: false,
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">...</div>;
  }

  // Group slots by day
  const byDay = new Map<number, typeof slots>();
  (slots ?? []).forEach((s) => {
    const list = byDay.get(s.dayOfWeek) ?? [];
    list.push(s);
    byDay.set(s.dayOfWeek, list);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("availability.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("availability.subtitle")}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowEditDialog(true)}
        >
          <Pencil className="mr-2 h-4 w-4" />
          {t("availability.save")}
        </Button>
      </div>

      {(!slots || slots.length === 0) && (
        <div className="text-center py-12 text-muted-foreground">
          {t("availability.noSlots")}
        </div>
      )}

      <div className="space-y-2">
        {DAY_KEYS.map((dayKey, dayIdx) => {
          const daySlots = byDay.get(dayIdx);
          if (!daySlots || daySlots.length === 0) return null;

          return (
            <div
              key={dayIdx}
              className="flex items-center gap-4 rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-900 shadow-sm">
                <Clock className="h-5 w-5 text-cyan-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t(`days.${dayKey}`)}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {daySlots.map((slot) => (
                    <span
                      key={slot.id}
                      className="inline-flex items-center text-xs bg-white dark:bg-gray-900 rounded-full px-2 py-0.5 border"
                    >
                      {slot.startTime} – {slot.endTime} ({t("availability.minutes", { count: slot.slotDurationMins })})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <EditAvailabilityDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        currentSlots={(slots ?? []).map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          slotDurationMins: s.slotDurationMins,
        }))}
      />
    </div>
  );
}
