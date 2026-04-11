import { CalendarDays, Dumbbell, Pill, User, Cake, BookOpen, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

export type CreatableEventType = "appointment" | "exercise" | "personal" | "birthday" | "reservation" | "other";
export type EventType = CreatableEventType | "medication";

export interface TimelineItem {
  type: EventType;
  time: string;
  title: string;
  subtitle: string | null;
  id: string;
}

const TYPE_CONFIG: Record<EventType, { icon: typeof CalendarDays; color: string; bg: string; border: string }> = {
  appointment:  { icon: CalendarDays,    color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950/30",   border: "border-blue-200 dark:border-blue-800" },
  exercise:     { icon: Dumbbell,        color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950/30",  border: "border-green-200 dark:border-green-800" },
  medication:   { icon: Pill,            color: "text-rose-600",   bg: "bg-rose-50 dark:bg-rose-950/30",   border: "border-rose-200 dark:border-rose-800" },
  personal:     { icon: User,            color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800" },
  birthday:     { icon: Cake,            color: "text-pink-600",   bg: "bg-pink-50 dark:bg-pink-950/30",   border: "border-pink-200 dark:border-pink-800" },
  reservation:  { icon: BookOpen,        color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950/30",  border: "border-amber-200 dark:border-amber-800" },
  other:        { icon: MoreHorizontal,  color: "text-gray-600",   bg: "bg-gray-50 dark:bg-gray-950/30",   border: "border-gray-200 dark:border-gray-800" },
};

interface EventCardProps {
  item: TimelineItem;
  onEdit?: (() => void) | undefined;
  isPast?: boolean | undefined;
}

export function EventCard({ item, onEdit, isPast }: EventCardProps) {
  const { t } = useTranslation("agenda");
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.other;
  const Icon = cfg.icon;

  return (
    <button
      onClick={onEdit}
      disabled={!onEdit}
      className={`w-full text-left flex items-center gap-3 rounded-xl border ${cfg.border} ${cfg.bg} p-4 transition-shadow hover:shadow-md ${isPast ? "opacity-60" : ""} ${onEdit ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-900 shadow-sm">
        <Icon className={`h-5 w-5 ${cfg.color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-muted-foreground">{item.time}</span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t(`event.${item.type}`)}
          </span>
        </div>
        <p className="font-semibold truncate">{item.title}</p>
        {item.subtitle && (
          <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
        )}
      </div>
    </button>
  );
}
