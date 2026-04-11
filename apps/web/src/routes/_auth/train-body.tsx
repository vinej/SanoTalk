import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { Button } from "../../components/ui/button";
import { EXERCISES, CATEGORIES, DIFFICULTIES } from "../../components/workouts/exercise-catalog";
import type { Exercise, ExerciseCategory, DifficultyLevel } from "../../components/workouts/exercise-catalog";
import { ExerciseCard } from "../../components/workouts/exercise-card";
import { ExerciseDetailDialog } from "../../components/workouts/exercise-detail-dialog";
import { LogWorkoutDialog } from "../../components/workouts/log-workout-dialog";
import { WeekCalendar } from "../../components/workouts/week-calendar";
import { WorkoutStatsCard } from "../../components/workouts/workout-stats-card";
import { WorkoutHistoryTable } from "../../components/workouts/workout-history-table";
import { ResourceList } from "../../components/workouts/resource-list";

export const Route = createFileRoute("/_auth/train-body")({
  component: TrainBodyPage,
});

function TrainBodyPage() {
  const { t } = useTranslation(["trainBody", "common"]);

  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | "all">("tai_chi");
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel | "all">("all");
  const [viewExercise, setViewExercise] = useState<Exercise | null>(null);
  const [logExercise, setLogExercise] = useState<Exercise | null>(null);

  const filteredExercises = useMemo(() => {
    return EXERCISES.filter((e) => {
      if (selectedCategory !== "all" && e.category !== selectedCategory) return false;
      if (selectedDifficulty !== "all" && e.difficulty !== selectedDifficulty) return false;
      return true;
    });
  }, [selectedCategory, selectedDifficulty]);

  function handleLogFromDetail(exercise: Exercise) {
    setViewExercise(null);
    setLogExercise(exercise);
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 py-6 space-y-4 overflow-auto">
      <div className="shrink-0 space-y-1">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common:backToDashboard")}
        </Link>
        <h1 className="text-2xl font-bold">{t("trainBody:title")}</h1>
        <p className="text-sm text-muted-foreground">{t("trainBody:subtitle")}</p>
      </div>

      {/* Safety disclaimer */}
      <details className="shrink-0 rounded-lg border bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
        <summary className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
          <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
          {t("trainBody:safety.title")}
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("trainBody:safety.disclaimer")}
        </p>
      </details>

      <Tabs defaultValue="exercises" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0">
          <TabsTrigger value="exercises">{t("trainBody:tabs.exercises")}</TabsTrigger>
          <TabsTrigger value="progress">{t("trainBody:tabs.progress")}</TabsTrigger>
          <TabsTrigger value="resources">{t("trainBody:tabs.resources")}</TabsTrigger>
        </TabsList>

        {/* Exercises Tab */}
        <TabsContent value="exercises" className="flex-1 overflow-auto space-y-4 mt-4">
          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={selectedCategory === "all" ? "default" : "outline"}
              className="text-xs h-7"
              onClick={() => setSelectedCategory("all")}
            >
              {t("trainBody:categories.all")}
            </Button>
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? "default" : "outline"}
                className="text-xs h-7"
                onClick={() => setSelectedCategory(cat)}
              >
                {t(`trainBody:categories.${cat}`)}
              </Button>
            ))}
          </div>

          {/* Difficulty filter */}
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={selectedDifficulty === "all" ? "secondary" : "ghost"}
              className="text-xs h-6"
              onClick={() => setSelectedDifficulty("all")}
            >
              {t("trainBody:difficulty.all")}
            </Button>
            {DIFFICULTIES.map((diff) => (
              <Button
                key={diff}
                size="sm"
                variant={selectedDifficulty === diff ? "secondary" : "ghost"}
                className="text-xs h-6"
                onClick={() => setSelectedDifficulty(diff)}
              >
                {t(`trainBody:difficulty.${diff}`)}
              </Button>
            ))}
          </div>

          {/* Exercise grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredExercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                onView={setViewExercise}
              />
            ))}
          </div>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="flex-1 overflow-auto space-y-6 mt-4">
          <WeekCalendar />
          <WorkoutStatsCard />
          <WorkoutHistoryTable />
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="flex-1 overflow-auto mt-4">
          <ResourceList />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ExerciseDetailDialog
        exercise={viewExercise}
        open={!!viewExercise}
        onOpenChange={(open) => { if (!open) setViewExercise(null); }}
        onLogWorkout={handleLogFromDetail}
      />
      <LogWorkoutDialog
        exercise={logExercise}
        open={!!logExercise}
        onOpenChange={(open) => { if (!open) setLogExercise(null); }}
      />
    </div>
  );
}
