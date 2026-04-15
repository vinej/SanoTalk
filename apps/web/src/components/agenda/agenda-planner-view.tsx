import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { trpc } from "../../lib/trpc";
import { AddEventDialog } from "./add-event-dialog";
import { TYPE_CONFIG, type CreatableEventType, type EventType } from "./event-card";

const MAX_VISIBLE_PER_CELL = 3;

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

interface PlannerEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  eventType: CreatableEventType;
  recurrenceRule: string | null;
}

interface DayCellProps {
  day: Date;
  events: PlannerEvent[];
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onSelectDay: (d: Date) => void;
  onCreate: (d: Date) => void;
  onEdit: (e: PlannerEvent) => void;
}

function DayCell({ day, events, inMonth, isToday, isSelected, onSelectDay, onCreate, onEdit }: DayCellProps) {
  const { t } = useTranslation("agenda");
  const visible = events.slice(0, MAX_VISIBLE_PER_CELL);
  const overflow = events.length - visible.length;

  const dayBg = inMonth ? "bg-background" : "bg-muted/30";
  const dayNumColor = inMonth ? "text-foreground" : "text-muted-foreground/60";
  const ring = isSelected ? "ring-2 ring-primary" : isToday ? "ring-1 ring-primary/50" : "";

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onSelectDay(day);
          if (events.length === 0) onCreate(day);
        }
      }}
      className={`relative flex flex-col gap-0.5 min-h-[96px] p-1 border border-border ${dayBg} ${ring} cursor-pointer transition-colors hover:bg-accent/40`}
    >
      <div
        className={`flex items-center justify-between px-1 ${dayNumColor}`}
        onClick={() => { onSelectDay(day); onCreate(day); }}
      >
        <span className={`text-xs font-medium ${isToday ? "h-5 w-5 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center" : ""}`}>
          {day.getDate()}
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        {visible.map((ev) => {
          const cfg = TYPE_CONFIG[ev.eventType as EventType] ?? TYPE_CONFIG.other;
          const time = ev.allDay ? "" : `${String(ev.startAt.getHours()).padStart(2, "0")}:${String(ev.startAt.getMinutes()).padStart(2, "0")} `;
          return (
            <button
              key={`${ev.id}-${ev.startAt.getTime()}`}
              onClick={(e) => { e.stopPropagation(); onEdit(ev); }}
              className={`text-left truncate text-[11px] leading-tight rounded px-1 py-0.5 ${cfg.bg} ${cfg.color} border ${cfg.border} hover:brightness-110`}
              title={`${time}${ev.title}`}
            >
              <span className="font-mono">{time}</span>
              <span className="font-medium">{ev.title}</span>
            </button>
          );
        })}
        {overflow > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="text-left text-[11px] leading-tight px-1 py-0.5 text-muted-foreground hover:text-foreground"
              >
                {t("planner.moreEvents", { count: overflow })}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
              <div className="text-xs font-semibold mb-1">
                {day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
              </div>
              <div className="flex flex-col gap-1">
                {events.map((ev) => {
                  const cfg = TYPE_CONFIG[ev.eventType as EventType] ?? TYPE_CONFIG.other;
                  const time = ev.allDay ? "" : `${String(ev.startAt.getHours()).padStart(2, "0")}:${String(ev.startAt.getMinutes()).padStart(2, "0")} `;
                  return (
                    <button
                      key={`${ev.id}-${ev.startAt.getTime()}-pop`}
                      onClick={() => onEdit(ev)}
                      className={`text-left text-xs rounded px-2 py-1 ${cfg.bg} ${cfg.color} border ${cfg.border} hover:brightness-110`}
                    >
                      <span className="font-mono">{time}</span>
                      <span className="font-medium">{ev.title}</span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

export function AgendaPlannerView() {
  const { t, i18n } = useTranslation("agenda");
  const [month, setMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogDate, setAddDialogDate] = useState<Date | undefined>(undefined);
  const [editEvent, setEditEvent] = useState<PlannerEvent | null>(null);

  // Build a 6-week grid covering the month
  const gridDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const rangeFrom = gridDays[0]!;
  const rangeTo = useMemo(() => {
    const d = new Date(gridDays[gridDays.length - 1]!);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [gridDays]);

  const { data: events } = trpc.agenda.listEvents.useQuery({
    from: rangeFrom.toISOString(),
    to: rangeTo.toISOString(),
  });

  // Group events by day key
  const eventsByDay = useMemo(() => {
    const map = new Map<string, PlannerEvent[]>();
    (events ?? []).forEach((e) => {
      const startAt = e.startAt instanceof Date ? e.startAt : new Date(e.startAt);
      const ev: PlannerEvent = {
        id: e.id,
        title: e.title,
        description: e.description ?? null,
        location: e.location ?? null,
        startAt,
        endAt: e.endAt ? (e.endAt instanceof Date ? e.endAt : new Date(e.endAt)) : null,
        allDay: e.allDay,
        eventType: e.eventType as CreatableEventType,
        recurrenceRule: e.recurrenceRule ?? null,
      };
      const key = dateKey(startAt);
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    });
    // Sort each day by time
    map.forEach((arr) => arr.sort((a, b) => a.startAt.getTime() - b.startAt.getTime()));
    return map;
  }, [events]);

  const today = new Date();
  const monthLabel = month.toLocaleDateString(i18n.language, { month: "long", year: "numeric" });

  // Set of date strings that have events (for sidebar dots)
  const daysWithEvents = useMemo(() => new Set(eventsByDay.keys()), [eventsByDay]);

  // Upcoming list (next 5 from today across visible range)
  const upcoming = useMemo(() => {
    const all: PlannerEvent[] = [];
    eventsByDay.forEach((arr) => all.push(...arr));
    return all
      .filter((e) => e.startAt.getTime() >= today.getTime())
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      .slice(0, 5);
  }, [eventsByDay]);

  function shiftMonth(delta: number) {
    setMonth((m) => {
      const d = new Date(m);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  }

  function goToToday() {
    const d = new Date();
    const m = new Date(d.getFullYear(), d.getMonth(), 1);
    setMonth(m);
    setSelectedDate(d);
  }

  function handleSidebarSelect(d: Date | undefined) {
    if (!d) return;
    setSelectedDate(d);
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }

  function handleCreate(d: Date) {
    setAddDialogDate(d);
    setEditEvent(null);
    setShowAddDialog(true);
  }

  function handleEdit(ev: PlannerEvent) {
    setEditEvent(ev);
    setAddDialogDate(undefined);
    setShowAddDialog(true);
  }

  // Localized weekday short names (Sun..Sat)
  const weekdayHeaders = useMemo(() => {
    const ref = new Date(2024, 0, 7); // Jan 7 2024 is a Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ref);
      d.setDate(ref.getDate() + i);
      return d.toLocaleDateString(i18n.language, { weekday: "short" });
    });
  }, [i18n.language]);

  return (
    <div className="flex gap-6 min-h-0">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col gap-4 w-[280px] shrink-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSidebarSelect}
          month={month}
          onMonthChange={setMonth}
          modifiers={{ hasEvent: (date) => daysWithEvents.has(dateKey(date)) }}
          modifiersClassNames={{
            hasEvent: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
          }}
          className="rounded-xl border shadow-sm p-3"
        />

        <div className="rounded-xl border p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {t("planner.upcoming")}
          </h3>
          {upcoming.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">{t("today.noEvents")}</p>
          )}
          <div className="flex flex-col gap-1.5">
            {upcoming.map((ev) => {
              const cfg = TYPE_CONFIG[ev.eventType as EventType] ?? TYPE_CONFIG.other;
              const Icon = cfg.icon;
              return (
                <button
                  key={`${ev.id}-up-${ev.startAt.getTime()}`}
                  onClick={() => handleEdit(ev)}
                  className="flex items-start gap-2 text-left text-xs p-1.5 rounded hover:bg-accent"
                >
                  <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{ev.title}</div>
                    <div className="text-muted-foreground text-[11px]">
                      {ev.startAt.toLocaleDateString(i18n.language, { month: "short", day: "numeric" })}
                      {!ev.allDay && ` · ${String(ev.startAt.getHours()).padStart(2, "0")}:${String(ev.startAt.getMinutes()).padStart(2, "0")}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Big month grid */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => shiftMonth(-1)} aria-label="previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => shiftMonth(1)} aria-label="next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="ml-2 text-lg font-semibold capitalize">{monthLabel}</h2>
            <Button size="sm" variant="outline" className="ml-2" onClick={goToToday}>
              {t("calendar.today")}
            </Button>
          </div>
          <Button size="sm" onClick={() => handleCreate(selectedDate)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("today.addEvent")}
          </Button>
        </div>

        <div className="rounded-xl border overflow-hidden">
          <div className="grid grid-cols-7 bg-muted/50 border-b">
            {weekdayHeaders.map((label, i) => (
              <div key={i} className="px-2 py-1.5 text-xs font-semibold text-muted-foreground text-center">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {gridDays.map((day) => {
              const inMonth = day.getMonth() === month.getMonth();
              const dayEvents = eventsByDay.get(dateKey(day)) ?? [];
              return (
                <DayCell
                  key={dateKey(day)}
                  day={day}
                  events={dayEvents}
                  inMonth={inMonth}
                  isToday={isSameDay(day, today)}
                  isSelected={isSameDay(day, selectedDate)}
                  onSelectDay={setSelectedDate}
                  onCreate={handleCreate}
                  onEdit={handleEdit}
                />
              );
            })}
          </div>
        </div>
      </div>

      <AddEventDialog
        open={showAddDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditEvent(null);
            setAddDialogDate(undefined);
          }
        }}
        {...(editEvent ? { editEvent } : {})}
        {...(addDialogDate ? { defaultDate: addDialogDate } : {})}
      />
    </div>
  );
}
