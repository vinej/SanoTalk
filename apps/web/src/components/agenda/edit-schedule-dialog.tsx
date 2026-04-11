import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { trpc } from "../../lib/trpc";

interface ScheduleTime {
  timeOfDay: string;
  label: string;
}

interface EditScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicationId: string;
  medicationName: string;
  currentSchedules: Array<{ timeOfDay: string; label: string | null }>;
}

export function EditScheduleDialog({
  open,
  onOpenChange,
  medicationId,
  medicationName,
  currentSchedules,
}: EditScheduleDialogProps) {
  const { t } = useTranslation("agenda");
  const utils = trpc.useUtils();

  const [times, setTimes] = useState<ScheduleTime[]>([]);

  useEffect(() => {
    if (open) {
      setTimes(
        currentSchedules.length > 0
          ? currentSchedules.map((s) => ({ timeOfDay: s.timeOfDay, label: s.label ?? "" }))
          : [{ timeOfDay: "08:00", label: "" }]
      );
    }
  }, [open, currentSchedules]);

  const mutation = trpc.agenda.setMedicationSchedule.useMutation({
    onSuccess: () => {
      utils.agenda.invalidate();
      onOpenChange(false);
      toast.success(t("medications.saved"));
    },
  });

  function addTime() {
    setTimes((prev) => [...prev, { timeOfDay: "12:00", label: "" }]);
  }

  function removeTime(idx: number) {
    setTimes((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateTime(idx: number, field: keyof ScheduleTime, value: string) {
    setTimes((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      medicationId,
      times: times
        .filter((tm) => tm.timeOfDay)
        .map((tm) => ({
          timeOfDay: tm.timeOfDay,
          label: tm.label || undefined,
        })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{medicationName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("medications.subtitle")}</p>

          <div className="space-y-3">
            {times.map((tm, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1">
                  <Label>{t("medications.timeOfDay")}</Label>
                  <Input
                    type="time"
                    value={tm.timeOfDay}
                    onChange={(e) => updateTime(idx, "timeOfDay", e.target.value)}
                    required
                  />
                </div>
                <div className="flex-1">
                  <Label>{t("medications.label")}</Label>
                  <Input
                    value={tm.label}
                    onChange={(e) => updateTime(idx, "label", e.target.value)}
                    placeholder={t("medications.labelPlaceholder")}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTime(idx)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addTime}>
            <Plus className="mr-2 h-4 w-4" />
            {t("medications.addTime")}
          </Button>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t("medications.saveSchedule")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
