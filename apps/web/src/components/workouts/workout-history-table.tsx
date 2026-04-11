import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { trpc } from "../../lib/trpc";
import { DIFFICULTY_COLORS } from "./exercise-catalog";

export function WorkoutHistoryTable() {
  const { t } = useTranslation("trainBody");
  const utils = trpc.useUtils();
  const { data: workouts } = trpc.workouts.list.useQuery({ limit: 50 });

  const deleteMutation = trpc.workouts.delete.useMutation({
    onSuccess: () => utils.workouts.invalidate(),
  });

  if (!workouts || workouts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        {t("progress.noWorkouts")}
      </p>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium mb-2">{t("progress.history")}</h3>
      <div className="rounded-md border overflow-auto max-h-[300px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{t("exercise.viewExercise")}</TableHead>
              <TableHead className="text-xs">{t("categories.all")}</TableHead>
              <TableHead className="text-xs">{t("exercise.duration")}</TableHead>
              <TableHead className="text-xs w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {workouts.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="text-xs">
                  <div>{t(`exercises.${w.exerciseId}.name`)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(w.completedAt).toLocaleDateString()}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${DIFFICULTY_COLORS[w.difficulty as keyof typeof DIFFICULTY_COLORS]}`}>
                    {t(`difficulty.${w.difficulty}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {t("progress.minutes", { count: Math.round(w.durationSecs / 60) })}
                </TableCell>
                <TableCell>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(t("progress.deleteConfirm"))) {
                        deleteMutation.mutate({ id: w.id });
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
