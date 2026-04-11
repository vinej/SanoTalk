import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { trpc } from "../../lib/trpc";
import type { Exercise } from "./exercise-catalog";

interface LogWorkoutDialogProps {
  exercise: Exercise | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogWorkoutDialog({ exercise, open, onOpenChange }: LogWorkoutDialogProps) {
  const { t } = useTranslation("trainBody");
  const utils = trpc.useUtils();
  const [durationMins, setDurationMins] = useState("");
  const [notes, setNotes] = useState("");

  const logMutation = trpc.workouts.log.useMutation({
    onSuccess: () => {
      utils.workouts.invalidate();
      onOpenChange(false);
      setDurationMins("");
      setNotes("");
    },
  });

  if (!exercise) return null;

  function handleSave() {
    if (!exercise) return;
    const mins = parseInt(durationMins, 10) || exercise.durationMins;
    logMutation.mutate({
      exerciseId: exercise.id,
      category: exercise.category,
      difficulty: exercise.difficulty,
      durationSecs: mins * 60,
    ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("log.title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t(`exercises.${exercise.id}.name`)}
        </p>
        <div className="space-y-3 mt-2">
          <div>
            <Label htmlFor="duration" className="text-xs">{t("log.duration")}</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              max={120}
              placeholder={String(exercise.durationMins)}
              value={durationMins}
              onChange={(e) => setDurationMins(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="notes" className="text-xs">{t("log.notes")}</Label>
            <Textarea
              id="notes"
              placeholder={t("log.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("log.cancel")}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={logMutation.isPending}>
            {logMutation.isPending ? t("log.saving") : t("log.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
