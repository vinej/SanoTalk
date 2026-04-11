import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { trpc } from "../../lib/trpc";

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When editing, pass the existing event */
  editEvent?: {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    startAt: Date;
    endAt: Date | null;
    allDay: boolean;
    eventType: "appointment" | "exercise";
    recurrenceRule: string | null;
  };
}

export function AddEventDialog({ open, onOpenChange, editEvent }: AddEventDialogProps) {
  const { t } = useTranslation("agenda");
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [eventType, setEventType] = useState<"appointment" | "exercise">("appointment");
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none");

  useEffect(() => {
    if (editEvent) {
      setTitle(editEvent.title);
      setDescription(editEvent.description ?? "");
      setLocation(editEvent.location ?? "");
      setDate(editEvent.startAt.toISOString().slice(0, 10));
      setStartTime(editEvent.startAt.toISOString().slice(11, 16));
      setEndTime(editEvent.endAt ? editEvent.endAt.toISOString().slice(11, 16) : "");
      setAllDay(editEvent.allDay);
      setEventType(editEvent.eventType);
      if (editEvent.recurrenceRule) {
        try {
          const rule = JSON.parse(editEvent.recurrenceRule);
          setRecurrence(rule.freq ?? "none");
        } catch {
          setRecurrence("none");
        }
      } else {
        setRecurrence("none");
      }
    } else {
      setTitle("");
      setDescription("");
      setLocation("");
      const today = new Date();
      setDate(today.toISOString().slice(0, 10));
      setStartTime("09:00");
      setEndTime("");
      setAllDay(false);
      setEventType("appointment");
      setRecurrence("none");
    }
  }, [editEvent, open]);

  const createMutation = trpc.agenda.createEvent.useMutation({
    onSuccess: () => {
      utils.agenda.invalidate();
      onOpenChange(false);
      toast.success(t("event.created"));
    },
  });

  const updateMutation = trpc.agenda.updateEvent.useMutation({
    onSuccess: () => {
      utils.agenda.invalidate();
      onOpenChange(false);
      toast.success(t("event.updated"));
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;

    const startAt = allDay
      ? new Date(`${date}T00:00:00`).toISOString()
      : new Date(`${date}T${startTime || "00:00"}:00`).toISOString();
    const endAt = endTime && !allDay
      ? new Date(`${date}T${endTime}:00`).toISOString()
      : undefined;
    const recurrenceRule = recurrence !== "none"
      ? JSON.stringify({ freq: recurrence })
      : undefined;

    if (editEvent) {
      updateMutation.mutate({
        id: editEvent.id,
        title,
        description: description || null,
        location: location || null,
        startAt,
        endAt: endAt ?? null,
        allDay,
        recurrenceRule: recurrenceRule ?? null,
      });
    } else {
      createMutation.mutate({
        title,
        description: description || undefined,
        location: location || undefined,
        startAt,
        endAt,
        allDay,
        eventType,
        recurrenceRule,
      });
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editEvent ? t("event.editEvent") : t("today.addEvent")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>{t("form.title")}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("form.titlePlaceholder")}
              required
              autoFocus
            />
          </div>

          <div>
            <Label>{t("form.eventType")}</Label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as "appointment" | "exercise")}
              disabled={!!editEvent}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="appointment">{t("event.appointment")}</option>
              <option value="exercise">{t("event.exercise")}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("form.date")}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex items-end gap-2 pb-0.5">
              <input
                type="checkbox"
                id="allDay"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="allDay" className="mb-0">{t("form.allDay")}</Label>
            </div>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("form.startTime")}</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div>
                <Label>{t("form.endTime")}</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <Label>{t("form.recurrence")}</Label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as "none" | "daily" | "weekly" | "monthly")}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="none">{t("form.recurrenceNone")}</option>
              <option value="daily">{t("form.recurrenceDaily")}</option>
              <option value="weekly">{t("form.recurrenceWeekly")}</option>
              <option value="monthly">{t("form.recurrenceMonthly")}</option>
            </select>
          </div>

          <div>
            <Label>{t("form.location")}</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t("form.locationPlaceholder")}
            />
          </div>

          <div>
            <Label>{t("form.description")}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("form.descriptionPlaceholder")}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={isLoading || !title.trim()}>
              {t("form.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
