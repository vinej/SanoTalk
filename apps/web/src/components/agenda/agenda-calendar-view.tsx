import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { trpc } from "../../lib/trpc";
import { DayDetailPanel } from "./day-detail-panel";
import { AddEventDialog } from "./add-event-dialog";
import type { TimelineItem, CreatableEventType } from "./event-card";

export function AgendaCalendarView() {
  const { t } = useTranslation("agenda");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editEvent, setEditEvent] = useState<any>(null);

  // Fetch events for the visible month to show dots
  const from = useMemo(() => {
    const d = new Date(month.getFullYear(), month.getMonth(), 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [month]);

  const to = useMemo(() => {
    const d = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [month]);

  const { data: monthEvents } = trpc.agenda.listEvents.useQuery({
    from: from.toISOString(),
    to: to.toISOString(),
  });

  // Set of date strings that have events
  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    (monthEvents ?? []).forEach((e) => {
      const d = e.startAt instanceof Date ? e.startAt : new Date(e.startAt);
      set.add(d.toISOString().slice(0, 10));
    });
    return set;
  }, [monthEvents]);

  function handleEditEvent(item: TimelineItem) {
    setEditEvent({
      id: item.id,
      title: item.title,
      description: item.subtitle,
      location: null,
      startAt: new Date(`${selectedDate.toISOString().slice(0, 10)}T${item.time}:00`),
      endAt: null,
      allDay: false,
      eventType: item.type as CreatableEventType,
      recurrenceRule: null,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const today = new Date();
            setSelectedDate(today);
            setMonth(today);
          }}
        >
          {t("calendar.today")}
        </Button>
        <Button size="sm" onClick={() => { setEditEvent(null); setShowAddDialog(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          {t("today.addEvent")}
        </Button>
      </div>

      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && setSelectedDate(date)}
          month={month}
          onMonthChange={setMonth}
          modifiers={{
            hasEvent: (date) => daysWithEvents.has(date.toISOString().slice(0, 10)),
          }}
          modifiersClassNames={{
            hasEvent: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-blue-500",
          }}
          className="rounded-xl border shadow-sm p-3"
        />
      </div>

      <DayDetailPanel
        date={selectedDate}
        onEditEvent={handleEditEvent}
      />

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
