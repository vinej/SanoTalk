import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { EventCard, type TimelineItem, type EventType } from "./event-card";

interface DayDetailPanelProps {
  date: Date;
  onEditEvent?: (item: TimelineItem) => void;
}

export function DayDetailPanel({ date, onEditEvent }: DayDetailPanelProps) {
  const { t } = useTranslation("agenda");

  const from = new Date(date);
  from.setHours(0, 0, 0, 0);
  const to = new Date(date);
  to.setHours(23, 59, 59, 999);

  const dateStr = date.toISOString().slice(0, 10);

  const { data: events } = trpc.agenda.listEvents.useQuery({
    from: from.toISOString(),
    to: to.toISOString(),
  });

  const { data: medReminders } = trpc.agenda.listMedicationReminders.useQuery({
    date: dateStr,
  });

  const eventItems: TimelineItem[] = (events ?? []).map((e) => ({
    type: e.eventType as EventType,
    time: e.startAt instanceof Date ? e.startAt.toISOString().slice(11, 16) : new Date(e.startAt).toISOString().slice(11, 16),
    title: e.title,
    subtitle: e.description ?? null,
    id: e.id,
  }));

  const medItems: TimelineItem[] = (medReminders ?? []).map((m) => ({
    type: "medication" as const,
    time: m.timeOfDay,
    title: m.medicationName,
    subtitle: [m.dosage, m.label].filter(Boolean).join(" — ") || null,
    id: m.scheduleId,
  }));

  const allItems = [...eventItems, ...medItems].sort((a, b) => a.time.localeCompare(b.time));

  const displayDate = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{displayDate}</h3>
      {allItems.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">{t("calendar.noEvents")}</p>
      )}
      <div className="space-y-2">
        {allItems.map((item) => (
          <EventCard
            key={`${item.id}-${item.time}`}
            item={item}
            onEdit={item.type !== "medication" && onEditEvent ? () => onEditEvent(item) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
