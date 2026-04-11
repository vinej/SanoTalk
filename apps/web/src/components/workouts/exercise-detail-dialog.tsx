import { useTranslation } from "react-i18next";
import { Clock, AlertTriangle } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import type { Exercise } from "./exercise-catalog";
import { DIFFICULTY_COLORS } from "./exercise-catalog";

interface ExerciseDetailDialogProps {
  exercise: Exercise | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogWorkout: (exercise: Exercise) => void;
}

export function ExerciseDetailDialog({
  exercise,
  open,
  onOpenChange,
  onLogWorkout,
}: ExerciseDetailDialogProps) {
  const { t } = useTranslation("trainBody");

  if (!exercise) return null;

  const steps: string[] = [];
  for (let i = 0; i < exercise.stepCount; i++) {
    steps.push(t(`exercises.${exercise.id}.steps.${i}`));
  }

  const safetyTip = t(`exercises.${exercise.id}.safetyTip`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(`exercises.${exercise.id}.name`)}</DialogTitle>
          <DialogDescription>
            {t(`exercises.${exercise.id}.description`)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={DIFFICULTY_COLORS[exercise.difficulty]}>
            {t(`difficulty.${exercise.difficulty}`)}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {t("exercise.duration", { mins: exercise.durationMins })}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("exercise.steps", { count: exercise.stepCount })}
          </span>
        </div>

        <ol className="mt-4 space-y-2 pl-5 list-decimal text-sm">
          {steps.map((step, i) => (
            <li key={i} className="text-muted-foreground leading-relaxed">
              {step}
            </li>
          ))}
        </ol>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300">{safetyTip}</p>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("log.cancel")}
          </Button>
          <Button size="sm" onClick={() => onLogWorkout(exercise)}>
            {t("exercise.logWorkout")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
