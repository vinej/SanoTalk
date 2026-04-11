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
import type { OutdoorActivity, OutdoorCategory, IntensityLevel } from "./activity-catalog";

interface LogOutdoorDialogProps {
  activity: OutdoorActivity | null;
  activityName: string;
  /** For custom activities, pass `custom:{uuid}` */
  activityId: string;
  category: OutdoorCategory;
  intensity: IntensityLevel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogOutdoorDialog({
  activity,
  activityName,
  activityId,
  category,
  intensity,
  open,
  onOpenChange,
}: LogOutdoorDialogProps) {
  const { t } = useTranslation("goOutside");
  const utils = trpc.useUtils();
  const [durationMins, setDurationMins] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [notes, setNotes] = useState("");

  const logMutation = trpc.outdoor.log.useMutation({
    onSuccess: () => {
      utils.outdoor.invalidate();
      onOpenChange(false);
      setDurationMins("");
      setDistanceKm("");
      setNotes("");
    },
  });

  function handleSave() {
    const mins = parseInt(durationMins, 10) || activity?.suggestedMins || 30;
    const distKm = parseFloat(distanceKm);
    logMutation.mutate({
      activityId,
      category,
      intensity,
      durationSecs: mins * 60,
      ...(distKm > 0 ? { distanceM: Math.round(distKm * 1000) } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("log.title")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{activityName}</p>
        <div className="space-y-3 mt-2">
          <div>
            <Label htmlFor="outdoor-duration" className="text-xs">{t("log.duration")}</Label>
            <Input
              id="outdoor-duration"
              type="number"
              min={1}
              max={480}
              placeholder={String(activity?.suggestedMins ?? 30)}
              value={durationMins}
              onChange={(e) => setDurationMins(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="outdoor-distance" className="text-xs">{t("log.distance")}</Label>
            <Input
              id="outdoor-distance"
              type="number"
              min={0}
              step={0.1}
              placeholder="0"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="outdoor-notes" className="text-xs">{t("log.notes")}</Label>
            <Textarea
              id="outdoor-notes"
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
            {t("log.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
