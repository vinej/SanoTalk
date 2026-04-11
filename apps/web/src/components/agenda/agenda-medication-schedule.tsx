import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pill, Clock, Pencil } from "lucide-react";
import { Button } from "../ui/button";
import { trpc } from "../../lib/trpc";
import { EditScheduleDialog } from "./edit-schedule-dialog";

export function AgendaMedicationSchedule() {
  const { t } = useTranslation("agenda");
  const todayStr = new Date().toISOString().slice(0, 10);

  const { data: reminders, isLoading } = trpc.agenda.listMedicationReminders.useQuery({
    date: todayStr,
  });

  // Fetch active medications to show even ones without schedules
  const { data: medications } = trpc.medications.list.useQuery();

  const [editMed, setEditMed] = useState<{
    id: string;
    name: string;
    schedules: Array<{ timeOfDay: string; label: string | null }>;
  } | null>(null);

  // Group reminders by medication
  const activeMeds = (medications ?? []).filter((m: any) => m.isActive);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">...</div>;
  }

  if (activeMeds.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t("medications.noMedications")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{t("medications.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("medications.subtitle")}</p>
      </div>

      <div className="space-y-3">
        {activeMeds.map((med: any) => {
          const medReminders = (reminders ?? []).filter(
            (r) => r.medicationId === med.id
          );

          return (
            <div
              key={med.id}
              className="flex items-center gap-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-900 shadow-sm">
                <Pill className="h-5 w-5 text-rose-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{med.name}</p>
                <p className="text-sm text-muted-foreground">{med.dosage}</p>
                {medReminders.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {medReminders.map((r) => (
                      <span
                        key={r.scheduleId}
                        className="inline-flex items-center gap-1 text-xs bg-white dark:bg-gray-900 rounded-full px-2 py-0.5 border"
                      >
                        <Clock className="h-3 w-3" />
                        {r.timeOfDay}
                        {r.label && <span className="text-muted-foreground">({r.label})</span>}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">{t("medications.noReminders")}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setEditMed({
                    id: med.id,
                    name: med.name,
                    schedules: medReminders.map((r) => ({
                      timeOfDay: r.timeOfDay,
                      label: r.label,
                    })),
                  })
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      {editMed && (
        <EditScheduleDialog
          open
          onOpenChange={(open) => { if (!open) setEditMed(null); }}
          medicationId={editMed.id}
          medicationName={editMed.name}
          currentSchedules={editMed.schedules}
        />
      )}
    </div>
  );
}
