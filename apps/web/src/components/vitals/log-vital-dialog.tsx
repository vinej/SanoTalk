import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Loader2, AlertTriangle } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { VITAL_CONFIGS, VITAL_MAP, type VitalType } from "./vital-config";
import { cn } from "../../lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: VitalType;
}

export function LogVitalDialog({ open, onOpenChange, defaultType }: Props) {
  const { t } = useTranslation("vitals");
  const utils = trpc.useUtils();
  const [type, setType] = useState<VitalType>(defaultType ?? "blood_pressure");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [notes, setNotes] = useState("");
  const [alert, setAlert] = useState<string | null>(null);

  useEffect(() => {
    if (open && defaultType) {
      setType(defaultType);
      setPrimary("");
      setSecondary("");
    }
  }, [open, defaultType]);

  const cfg = VITAL_MAP[type];
  const logMutation = trpc.vitals.log.useMutation({
    onSuccess: (result) => {
      if (result.alert) {
        setAlert(result.alert);
      } else {
        resetAndClose();
      }
      void utils.vitals.list.invalidate();
      void utils.vitals.latest.invalidate();
    },
  });

  function resetAndClose() {
    setPrimary("");
    setSecondary("");
    setNotes("");
    setAlert(null);
    onOpenChange(false);
  }

  function handleSubmit() {
    const p = parseFloat(primary);
    if (isNaN(p)) return;
    const s = cfg?.hasSecondary ? parseFloat(secondary) : null;
    if (cfg?.hasSecondary && (isNaN(s!) || s === null)) return;

    logMutation.mutate({
      type,
      valuePrimary: p,
      valueSecondary: s,
      unit: cfg?.unit ?? "",
      notes: notes.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("logReading")}</DialogTitle>
          <DialogDescription>{t("logReadingDesc")}</DialogDescription>
        </DialogHeader>

        {alert ? (
          <div className="space-y-4 py-2">
            <div className={cn(
              "flex items-start gap-3 rounded-lg border p-4",
              alert === "high"
                ? "border-red-300 bg-red-50 dark:bg-red-950/30"
                : "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30"
            )}>
              <AlertTriangle className={cn(
                "h-5 w-5 shrink-0 mt-0.5",
                alert === "high" ? "text-red-600" : "text-yellow-600"
              )} />
              <div>
                <p className={cn(
                  "font-semibold text-sm",
                  alert === "high" ? "text-red-700" : "text-yellow-700"
                )}>
                  {t(`alert.${alert}Title`, { type: t(`types.${type}`) })}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t(`alert.${alert}Desc`)}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>{t("close")}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Type selector */}
            <div className="space-y-1.5">
              <Label>{t("vitalType")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {VITAL_CONFIGS.map((c) => (
                  <button
                    key={c.type}
                    onClick={() => { setType(c.type); setPrimary(""); setSecondary(""); }}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-full border transition-colors",
                      type === c.type
                        ? "text-white border-transparent"
                        : "text-foreground hover:bg-muted"
                    )}
                    style={type === c.type ? { backgroundColor: c.color } : undefined}
                  >
                    {t(`types.${c.type}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Value inputs */}
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label>{cfg?.hasSecondary ? t("labels.systolic") : t("value")} ({cfg?.unit})</Label>
                <Input
                  type="number"
                  step={type === "temperature" ? "0.1" : "1"}
                  value={primary}
                  onChange={(e) => setPrimary(e.target.value)}
                  placeholder={type === "temperature" ? "36.6" : "120"}
                  autoFocus
                />
              </div>
              {cfg?.hasSecondary && (
                <div className="flex-1 space-y-1.5">
                  <Label>{t("labels.diastolic")} ({cfg.unit})</Label>
                  <Input
                    type="number"
                    value={secondary}
                    onChange={(e) => setSecondary(e.target.value)}
                    placeholder="80"
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>{t("notes")}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
                maxLength={500}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>{t("cancel")}</Button>
              <Button onClick={handleSubmit} disabled={!primary || logMutation.isPending}>
                {logMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : t("save")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
