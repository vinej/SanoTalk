import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { trpc } from "../../lib/trpc";
import { EventCard, type TimelineItem, type EventType, type CreatableEventType } from "./event-card";
import { AddEventDialog } from "./add-event-dialog";

interface AgendaRangeViewProps {
  mode: "week" | "month";
}

function getWeekRange(ref: Date) {
  const d = new Date(ref);
  const day = d.getDay(); // 0=Sun
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange(ref: Date) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function AgendaRangeView({ mode }: AgendaRangeViewProps) {
  const { t } = useTranslation("agenda");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);
  const utils = trpc.useUtils();

  const now = new Date();
  const range = useMemo(
    () => (mode === "week" ? getWeekRange(now) : getMonthRange(now)),
    [mode],
  );

  const { data: events, isLoading } = trpc.agenda.listEvents.useQuery({
    from: range.start.toISOString(),
    to: range.end.toISOString(),
  });

  const deleteMutation = trpc.agenda.deleteEvent.useMutation({
    onSuccess: () => {
      utils.agenda.invalidate();
      toast.success(t("event.deleted"));
    },
  });

  // Group events by date
  const groupedByDay = useMemo(() => {
    if (!events) return [];
    const map = new Map<string, typeof events>();
    for (const ev of events) {
      const d = ev.startAt instanceof Date ? ev.startAt : new Date(ev.startAt);
      const key = d.toISOString().slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, evts]) => ({ dateStr, events: evts }));
  }, [events]);

  const rangeLabel = mode === "week"
    ? `${range.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${range.end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : range.start.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function handleEdit(item: TimelineItem, dateStr: string) {
    setEditEvent({
      id: item.id,
      title: item.title,
      description: item.subtitle,
      location: null,
      startAt: new Date(`${dateStr}T${item.time}:00`),
      endAt: null,
      allDay: false,
      eventType: item.type as CreatableEventType,
      recurrenceRule: null,
    });
  }

  function handleDelete(item: TimelineItem) {
    if (item.type === "medication") return;
    if (confirm(t("event.deleteConfirm"))) {
      deleteMutation.mutate({ id: item.id });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {mode === "week" ? t("calendar.thisWeek") : t("calendar.thisMonth")}
          </h2>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </div>
        <Button size="sm" onClick={() => { setEditEvent(null); setShowAddDialog(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t("today.addEvent")}
        </Button>
      </div>

      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">...</div>
      )}

      {!isLoading && groupedByDay.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-12">
          {t("calendar.noEvents")}
        </p>
      )}

      {groupedByDay.map(({ dateStr, events: evts }) => {
        const d = new Date(dateStr + "T12:00:00");
        const todayStr = now.toISOString().slice(0, 10);
        const isToday = dateStr === todayStr;
        const dayLabel = d.toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        });

        const items: TimelineItem[] = evts.map((e) => ({
          type: e.eventType as EventType,
          time: (e.startAt instanceof Date ? e.startAt : new Date(e.startAt))
            .toISOString()
            .slice(11, 16),
          title: e.title,
          subtitle: e.description ?? null,
          id: e.id,
        }));

        return (
          <div key={dateStr} className="space-y-2">
            <h4 className={`text-sm font-medium ${isToday ? "text-primary font-semibold" : "text-muted-foreground"}`}>
              {dayLabel}
              {isToday && <span className="ml-2 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">{t("calendar.today")}</span>}
            </h4>
            {items.map((item) => (
              <div key={`${item.id}-${item.time}`} className="relative group">
                <EventCard
                  item={item}
                  onEdit={() => handleEdit(item, dateStr)}
                />
                <button
                  onClick={() => handleDelete(item)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        );
      })}

      <AddEventDialog
        open={showAddDialog || !!editEvent}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditEvent(null);
          }
        }}
        editEvent={editEvent ?? undefined}
      />
    </div>
  );
}
