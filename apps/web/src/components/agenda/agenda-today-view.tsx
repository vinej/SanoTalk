import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { trpc } from "../../lib/trpc";
import { EventCard, type TimelineItem, type CreatableEventType } from "./event-card";
import { AddEventDialog } from "./add-event-dialog";

export function AgendaTodayView() {
  const { t } = useTranslation("agenda");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);

  const { data: timeline, isLoading } = trpc.agenda.todayOverview.useQuery();
  const utils = trpc.useUtils();

  const deleteMutation = trpc.agenda.deleteEvent.useMutation({
    onSuccess: () => {
      utils.agenda.invalidate();
      toast.success(t("event.deleted"));
    },
  });

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const todayStr = now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Compute display time from startAt Date (browser local TZ) for events,
  // or use the time string directly for medication items.
  const items = (timeline ?? []).map((item) => {
    if (item.startAt) {
      const d = item.startAt instanceof Date ? item.startAt : new Date(item.startAt);
      return {
        ...item,
        time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      };
    }
    return { ...item, time: item.time ?? "00:00" };
  }) as TimelineItem[];

  const upcomingItems = items.filter((item) => item.time >= currentTime);
  const pastItems = items.filter((item) => item.time < currentTime);

  function handleEdit(item: TimelineItem) {
    if (item.type === "medication") return;
    const startAt = item.startAt
      ? (item.startAt instanceof Date ? item.startAt : new Date(item.startAt))
      : new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${item.time}:00`);
    setEditEvent({
      id: item.id,
      title: item.title,
      description: item.subtitle,
      location: null,
      startAt,
      endAt: null,
      allDay: false,
      eventType: item.type as CreatableEventType,
      recurrenceRule: item.recurrenceRule ?? null,
    });
  }

  function handleDelete(item: TimelineItem) {
    if (item.type === "medication") return;
    const msg = item.recurrenceRule ? t("event.deleteRecurringConfirm") : t("event.deleteConfirm");
    if (confirm(msg)) {
      deleteMutation.mutate({ id: item.id });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{todayStr}</h2>
        <Button size="sm" onClick={() => { setEditEvent(null); setShowAddDialog(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t("today.addEvent")}
        </Button>
      </div>

      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">...</div>
      )}

      {!isLoading && (!timeline || timeline.length === 0) && (
        <div className="text-center py-12 text-muted-foreground">
          {t("today.noEvents")}
        </div>
      )}

      {upcomingItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {t("today.upcoming")}
          </h3>
          <div className="space-y-2">
            {upcomingItems.map((item) => (
              <div key={`${item.id}-${item.time}`} className="relative group">
                <EventCard
                  item={item}
                  onEdit={item.type !== "medication" ? () => handleEdit(item) : undefined}
                />
                {item.type !== "medication" && (
                  <button
                    onClick={() => handleDelete(item)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {pastItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {t("today.past")}
          </h3>
          <div className="space-y-2">
            {pastItems.map((item) => (
              <div key={`${item.id}-${item.time}`} className="relative group">
                <EventCard item={item} isPast />
                {item.type !== "medication" && (
                  <button
                    onClick={() => handleDelete(item)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
