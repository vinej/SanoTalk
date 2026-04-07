import { useState, useEffect, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Loader2, X } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { SCORE_CATEGORIES, getScoreColor } from "./symptom-config";
import { cn } from "../../lib/utils";

interface SymptomEntry {
  id: string;
  date: string;
  painLevel: number | null;
  mood: number | null;
  energy: number | null;
  sleepQuality: number | null;
  sleepHours: number | null;
  stress: number | null;
  appetite: number | null;
  customSymptoms: string[] | null;
  bodyLocation: string | null;
  notes: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editEntry?: SymptomEntry | null;
}

export function LogSymptomDialog({ open, onOpenChange, editEntry }: Props) {
  const { t } = useTranslation("symptoms");
  const utils = trpc.useUtils();

  const [date, setDate] = useState(new Date().toISOString().split("T")[0]!);
  const [painLevel, setPainLevel] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState<string>("");
  const [stress, setStress] = useState<number | null>(null);
  const [appetite, setAppetite] = useState<number | null>(null);
  const [customSymptoms, setCustomSymptoms] = useState<string[]>([]);
  const [symptomInput, setSymptomInput] = useState("");
  const [bodyLocation, setBodyLocation] = useState("");
  const [notes, setNotes] = useState("");

  const scoreState: Record<string, { value: number | null; set: (v: number | null) => void }> = {
    painLevel: { value: painLevel, set: setPainLevel },
    mood: { value: mood, set: setMood },
    energy: { value: energy, set: setEnergy },
    sleepQuality: { value: sleepQuality, set: setSleepQuality },
    stress: { value: stress, set: setStress },
    appetite: { value: appetite, set: setAppetite },
  };

  const isEdit = !!editEntry;

  useEffect(() => {
    if (open && editEntry) {
      setDate(editEntry.date);
      setPainLevel(editEntry.painLevel);
      setMood(editEntry.mood);
      setEnergy(editEntry.energy);
      setSleepQuality(editEntry.sleepQuality);
      setSleepHours(editEntry.sleepHours != null ? String(editEntry.sleepHours) : "");
      setStress(editEntry.stress);
      setAppetite(editEntry.appetite);
      setCustomSymptoms(editEntry.customSymptoms ?? []);
      setBodyLocation(editEntry.bodyLocation ?? "");
      setNotes(editEntry.notes ?? "");
    } else if (open) {
      resetForm();
    }
  }, [open, editEntry]);

  function resetForm() {
    setDate(new Date().toISOString().split("T")[0]!);
    setPainLevel(null);
    setMood(null);
    setEnergy(null);
    setSleepQuality(null);
    setSleepHours("");
    setStress(null);
    setAppetite(null);
    setCustomSymptoms([]);
    setSymptomInput("");
    setBodyLocation("");
    setNotes("");
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  const logMutation = trpc.symptoms.log.useMutation({
    onSuccess: () => {
      void utils.symptoms.list.invalidate();
      handleClose();
    },
  });

  function handleAddSymptom() {
    const tag = symptomInput.trim();
    if (tag && !customSymptoms.includes(tag) && customSymptoms.length < 20) {
      setCustomSymptoms([...customSymptoms, tag]);
      setSymptomInput("");
    }
  }

  function handleRemoveSymptom(tag: string) {
    setCustomSymptoms(customSymptoms.filter((s) => s !== tag));
  }

  function handleSymptomKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSymptom();
    }
  }

  function handleSubmit() {
    if (!date) return;

    logMutation.mutate({
      date,
      painLevel: painLevel,
      mood: mood,
      energy: energy,
      sleepQuality: sleepQuality,
      sleepHours: sleepHours ? parseFloat(sleepHours) : null,
      stress: stress,
      appetite: appetite,
      customSymptoms: customSymptoms.length > 0 ? customSymptoms : undefined,
      bodyLocation: bodyLocation.trim() || null,
      notes: notes.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editEntry") : t("logSymptoms")}</DialogTitle>
          <DialogDescription>{isEdit ? t("editEntry") : t("logSymptomsDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Date */}
          <div className="space-y-1.5">
            <Label>{t("date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* Score sliders */}
          {SCORE_CATEGORIES.map((cat) => {
            const state = scoreState[cat.key]!;
            const val = state.value;
            return (
              <div key={cat.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{t(cat.key)}</Label>
                  <span className={cn("text-sm font-semibold tabular-nums", val != null ? getScoreColor(val, cat.max, cat.inverted) : "text-muted-foreground")}>
                    {val != null ? `${val}/${cat.max}` : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-4 text-right">{cat.min}</span>
                  <input
                    type="range"
                    min={cat.min}
                    max={cat.max}
                    step={1}
                    value={val ?? cat.min}
                    onChange={(e) => state.set(parseInt(e.target.value))}
                    className="flex-1 h-2 accent-current cursor-pointer"
                    style={{ color: cat.color }}
                  />
                  <span className="text-xs text-muted-foreground w-4">{cat.max}</span>
                </div>
              </div>
            );
          })}

          {/* Sleep hours */}
          <div className="space-y-1.5">
            <Label>{t("sleepHours")}</Label>
            <Input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={sleepHours}
              onChange={(e) => setSleepHours(e.target.value)}
              placeholder="7.5"
              className="w-28"
            />
          </div>

          {/* Custom symptoms tags */}
          <div className="space-y-1.5">
            <Label>{t("customSymptoms")}</Label>
            <div className="flex gap-2">
              <Input
                value={symptomInput}
                onChange={(e) => setSymptomInput(e.target.value)}
                onKeyDown={handleSymptomKeyDown}
                placeholder={t("customSymptomsPlaceholder")}
                className="flex-1"
              />
              <Button type="button" size="sm" variant="outline" onClick={handleAddSymptom} disabled={!symptomInput.trim()}>
                +
              </Button>
            </div>
            {customSymptoms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {customSymptoms.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button type="button" onClick={() => handleRemoveSymptom(tag)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Body location */}
          <div className="space-y-1.5">
            <Label>{t("bodyLocation")}</Label>
            <Input value={bodyLocation} onChange={(e) => setBodyLocation(e.target.value)} placeholder={t("bodyLocationPlaceholder")} />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>{t("notes")}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPlaceholder")} maxLength={500} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t("cancel")}</Button>
          <Button onClick={handleSubmit} disabled={!date || logMutation.isPending}>
            {logMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
