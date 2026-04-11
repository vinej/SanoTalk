import { useTranslation } from "react-i18next";
import { Clock, Play, Footprints, Bike, Waves, Mountain, Flower2, TreePine, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../ui/badge";
import type { OutdoorActivity, OutdoorCategory } from "./activity-catalog";
import { CATEGORY_COLORS, INTENSITY_COLORS } from "./activity-catalog";

const CATEGORY_ICONS: Record<OutdoorCategory, LucideIcon> = {
  walking: Footprints,
  fast_walking: Zap,
  running: Footprints,
  cycling: Bike,
  swimming: Waves,
  hiking: Mountain,
  gardening: Flower2,
  other: TreePine,
};

interface ActivityCardProps {
  activity: OutdoorActivity;
  name: string;
  description: string;
  onView: () => void;
}

export function ActivityCard({ activity, name, description, onView }: ActivityCardProps) {
  const { t } = useTranslation("goOutside");
  const catColor = CATEGORY_COLORS[activity.category];
  const intColor = INTENSITY_COLORS[activity.intensity];
  const CatIcon = CATEGORY_ICONS[activity.category];

  return (
    <button
      type="button"
      onClick={onView}
      className={`rounded-lg border ${catColor.border} ${catColor.bg} p-4 flex flex-col gap-2 text-left cursor-pointer transition-shadow hover:shadow-md`}
    >
      <div className="flex items-center gap-1.5">
        <CatIcon className={`h-4 w-4 shrink-0 ${catColor.text}`} />
        <h3 className={`text-sm font-semibold ${catColor.text}`}>{name}</h3>
        <span className="ml-auto" aria-label={t("activity.hasVideo")}>
          <Play className="h-3 w-3 shrink-0 text-red-500 fill-red-500 opacity-70" />
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
      <div className="flex items-center gap-2 mt-auto">
        <Badge variant="outline" className={`text-[10px] ${intColor}`}>
          {t(`intensity.${activity.intensity}`)}
        </Badge>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {t("activity.duration", { mins: activity.suggestedMins })}
        </span>
      </div>
    </button>
  );
}
