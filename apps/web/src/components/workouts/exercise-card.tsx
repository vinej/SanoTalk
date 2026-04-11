import { useTranslation } from "react-i18next";
import { Clock, Play, Wind, MoveHorizontal, Scale, Dumbbell, HeartPulse } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "../ui/badge";
import type { Exercise, ExerciseCategory } from "./exercise-catalog";
import { CATEGORY_COLORS, DIFFICULTY_COLORS } from "./exercise-catalog";

const CATEGORY_ICONS: Record<ExerciseCategory, LucideIcon> = {
  tai_chi: Wind,
  stretching: MoveHorizontal,
  balance: Scale,
  strength: Dumbbell,
  cardio: HeartPulse,
};

interface ExerciseCardProps {
  exercise: Exercise;
  onView: (exercise: Exercise) => void;
}

export function ExerciseCard({ exercise, onView }: ExerciseCardProps) {
  const { t } = useTranslation("trainBody");
  const catColor = CATEGORY_COLORS[exercise.category];
  const diffColor = DIFFICULTY_COLORS[exercise.difficulty];
  const CatIcon = CATEGORY_ICONS[exercise.category];

  return (
    <button
      type="button"
      onClick={() => onView(exercise)}
      className={`rounded-lg border ${catColor.border} ${catColor.bg} p-4 flex flex-col gap-2 text-left cursor-pointer transition-shadow hover:shadow-md`}
    >
      <div className="flex items-center gap-1.5">
        <CatIcon className={`h-4 w-4 shrink-0 ${catColor.text}`} />
        <h3 className={`text-sm font-semibold ${catColor.text}`}>
          {t(`exercises.${exercise.id}.name`)}
        </h3>
        <span className="ml-auto" aria-label={t("exercise.hasVideo")}>
          <Play className="h-3 w-3 shrink-0 text-red-500 fill-red-500 opacity-70" />
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">
        {t(`exercises.${exercise.id}.description`)}
      </p>
      <div className="flex items-center gap-2 mt-auto">
        <Badge variant="outline" className={`text-[10px] ${diffColor}`}>
          {t(`difficulty.${exercise.difficulty}`)}
        </Badge>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {t("exercise.duration", { mins: exercise.durationMins })}
        </span>
      </div>
    </button>
  );
}
