import { useTranslation } from "react-i18next";
import { Clock, ChevronRight } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { Exercise } from "./exercise-catalog";
import { CATEGORY_COLORS, DIFFICULTY_COLORS } from "./exercise-catalog";

interface ExerciseCardProps {
  exercise: Exercise;
  onView: (exercise: Exercise) => void;
}

export function ExerciseCard({ exercise, onView }: ExerciseCardProps) {
  const { t } = useTranslation("trainBody");
  const catColor = CATEGORY_COLORS[exercise.category];
  const diffColor = DIFFICULTY_COLORS[exercise.difficulty];

  return (
    <div
      className={`rounded-lg border ${catColor.border} ${catColor.bg} p-4 flex flex-col gap-2`}
    >
      <h3 className={`text-sm font-semibold ${catColor.text}`}>
        {t(`exercises.${exercise.id}.name`)}
      </h3>
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
      <Button
        size="sm"
        variant="ghost"
        className="mt-1 w-full justify-between text-xs"
        onClick={() => onView(exercise)}
      >
        {t("exercise.viewExercise")}
        <ChevronRight className="h-3 w-3" />
      </Button>
    </div>
  );
}
