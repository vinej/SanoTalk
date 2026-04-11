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

interface SlotDraft {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMins: number;
}

interface EditAvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSlots: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMins: number;
  }>;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function EditAvailabilityDialog({
  open,
  onOpenChange,
  currentSlots,
}: EditAvailabilityDialogProps) {
  const { t } = useTranslation("agenda");
  const utils = trpc.useUtils();

  const [slots, setSlots] = useState<SlotDraft[]>([]);

  useEffect(() => {
    if (open) {
      setSlots(
        currentSlots.length > 0
          ? currentSlots.map((s) => ({ ...s }))
          : [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00", slotDurationMins: 30 }]
      );
    }
  }, [open, currentSlots]);

  const mutation = trpc.agenda.setAvailability.useMutation({
    onSuccess: () => {
      utils.agenda.invalidate();
      onOpenChange(false);
      toast.success(t("availability.saved"));
    },
  });

  function addSlot() {
    setSlots((prev) => [
      ...prev,
      { dayOfWeek: 1, startTime: "09:00", endTime: "12:00", slotDurationMins: 30 },
    ]);
  }

  function removeSlot(idx: number) {
    setSlots((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSlot(idx: number, field: keyof SlotDraft, value: string | number) {
    setSlots((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      slots: slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        slotDurationMins: s.slotDurationMins,
      })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("availability.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("availability.subtitle")}</p>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {slots.map((slot, idx) => (
              <div key={idx} className="flex items-end gap-2 flex-wrap border rounded-lg p-3">
                <div>
                  <Label>{t("form.date")}</Label>
                  <select
                    value={slot.dayOfWeek}
                    onChange={(e) => updateSlot(idx, "dayOfWeek", parseInt(e.target.value))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    {DAY_KEYS.map((key, i) => (
                      <option key={i} value={i}>{t(`days.${key}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("availability.startTime")}</Label>
                  <Input
                    type="time"
                    value={slot.startTime}
                    onChange={(e) => updateSlot(idx, "startTime", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>{t("availability.endTime")}</Label>
                  <Input
                    type="time"
                    value={slot.endTime}
                    onChange={(e) => updateSlot(idx, "endTime", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>{t("availability.slotDuration")}</Label>
                  <select
                    value={slot.slotDurationMins}
                    onChange={(e) => updateSlot(idx, "slotDurationMins", parseInt(e.target.value))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    <option value={15}>{t("availability.minutes", { count: 15 })}</option>
                    <option value={30}>{t("availability.minutes", { count: 30 })}</option>
                    <option value={45}>{t("availability.minutes", { count: 45 })}</option>
                    <option value={60}>{t("availability.minutes", { count: 60 })}</option>
                  </select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSlot(idx)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addSlot}>
            <Plus className="mr-2 h-4 w-4" />
            {t("availability.addSlot")}
          </Button>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {t("availability.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
