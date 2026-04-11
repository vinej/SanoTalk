import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { trpc } from "../../lib/trpc";
import { CATEGORIES, INTENSITIES } from "./activity-catalog";
import type { OutdoorCategory, IntensityLevel } from "./activity-catalog";

interface CreateActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateActivityDialog({ open, onOpenChange }: CreateActivityDialogProps) {
  const { t } = useTranslation("goOutside");
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<OutdoorCategory>("walking");
  const [intensity, setIntensity] = useState<IntensityLevel>("moderate");
  const [suggestedMins, setSuggestedMins] = useState("30");

  const createMutation = trpc.outdoor.customActivities.create.useMutation({
    onSuccess: () => {
      utils.outdoor.customActivities.invalidate();
      onOpenChange(false);
      setName("");
      setCategory("walking");
      setIntensity("moderate");
      setSuggestedMins("30");
    },
  });

  function handleCreate() {
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      category,
      intensity,
      suggestedMins: parseInt(suggestedMins, 10) || 30,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("create.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label htmlFor="custom-name" className="text-xs">{t("create.name")}</Label>
            <Input
              id="custom-name"
              placeholder={t("create.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="custom-category" className="text-xs">{t("create.category")}</Label>
            <select
              id="custom-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as OutdoorCategory)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{t(`categories.${cat}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="custom-intensity" className="text-xs">{t("create.intensityLabel")}</Label>
            <select
              id="custom-intensity"
              value={intensity}
              onChange={(e) => setIntensity(e.target.value as IntensityLevel)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {INTENSITIES.map((int) => (
                <option key={int} value={int}>{t(`intensity.${int}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="custom-mins" className="text-xs">{t("create.suggestedMins")}</Label>
            <Input
              id="custom-mins"
              type="number"
              min={1}
              max={480}
              value={suggestedMins}
              onChange={(e) => setSuggestedMins(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("create.cancel")}
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={!name.trim() || createMutation.isPending}>
            {t("create.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
