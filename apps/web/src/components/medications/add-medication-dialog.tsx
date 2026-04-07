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
import { Loader2 } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { FREQUENCY_OPTIONS, ROUTE_OPTIONS } from "./medication-config";
import { cn } from "../../lib/utils";

interface MedicationRecord {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route?: string | null;
  prescribedBy?: string | null;
  reason?: string | null;
  startDate: string | Date;
  endDate?: string | Date | null;
  isActive: boolean;
  notes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editMedication?: MedicationRecord | null;
}

function toDateInputValue(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toISOString().split("T")[0]!;
}

export function AddMedicationDialog({ open, onOpenChange, editMedication }: Props) {
  const { t } = useTranslation("medications");
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("once_daily");
  const [route, setRoute] = useState("");
  const [prescribedBy, setPrescribedBy] = useState("");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]!);
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");

  const isEdit = !!editMedication;

  useEffect(() => {
    if (open && editMedication) {
      setName(editMedication.name);
      setDosage(editMedication.dosage);
      setFrequency(editMedication.frequency);
      setRoute(editMedication.route ?? "");
      setPrescribedBy(editMedication.prescribedBy ?? "");
      setReason(editMedication.reason ?? "");
      setStartDate(toDateInputValue(editMedication.startDate));
      setEndDate(toDateInputValue(editMedication.endDate));
      setIsActive(editMedication.isActive);
      setNotes(editMedication.notes ?? "");
    } else if (open) {
      resetForm();
    }
  }, [open, editMedication]);

  function resetForm() {
    setName("");
    setDosage("");
    setFrequency("once_daily");
    setRoute("");
    setPrescribedBy("");
    setReason("");
    setStartDate(new Date().toISOString().split("T")[0]!);
    setEndDate("");
    setIsActive(true);
    setNotes("");
  }

  function handleClose() {
    resetForm();
    onOpenChange(false);
  }

  const addMutation = trpc.medications.add.useMutation({
    onSuccess: () => {
      void utils.medications.list.invalidate();
      handleClose();
    },
  });

  const updateMutation = trpc.medications.update.useMutation({
    onSuccess: () => {
      void utils.medications.list.invalidate();
      handleClose();
    },
  });

  const isPending = addMutation.isPending || updateMutation.isPending;

  function handleSubmit() {
    if (!name.trim() || !dosage.trim() || !startDate) return;

    const startIso = new Date(startDate).toISOString();
    const endIso = endDate ? new Date(endDate).toISOString() : null;

    if (isEdit && editMedication) {
      updateMutation.mutate({
        id: editMedication.id,
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        route: route || null,
        prescribedBy: prescribedBy.trim() || null,
        reason: reason.trim() || null,
        startDate: startIso,
        endDate: endIso,
        isActive,
        notes: notes.trim() || null,
      });
    } else {
      addMutation.mutate({
        name: name.trim(),
        dosage: dosage.trim(),
        frequency,
        route: route || undefined,
        prescribedBy: prescribedBy.trim() || undefined,
        reason: reason.trim() || undefined,
        startDate: startIso,
        endDate: endIso,
        notes: notes.trim() || undefined,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editMedication") : t("addMedication")}</DialogTitle>
          <DialogDescription>{isEdit ? t("editMedicationDesc") : t("addMedicationDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name + Dosage */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>{t("name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Metformin" autoFocus />
            </div>
            <div className="w-32 space-y-1.5">
              <Label>{t("dosage")}</Label>
              <Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="500 mg" />
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <Label>{t("frequency")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {FREQUENCY_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-full border transition-colors",
                    frequency === f
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  {t(`freq.${f}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Route */}
          <div className="space-y-1.5">
            <Label>{t("route")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {ROUTE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoute(route === r ? "" : r)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-full border transition-colors",
                    route === r
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  {t(`routes.${r}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Prescribed by + Reason */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>{t("prescribedBy")}</Label>
              <Input value={prescribedBy} onChange={(e) => setPrescribedBy(e.target.value)} placeholder={t("prescribedByPlaceholder")} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>{t("reason")}</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} />
            </div>
          </div>

          {/* Start + End date */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>{t("startDate")}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>{t("endDate")}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* Active toggle (edit mode only) */}
          {isEdit && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  isActive ? "bg-green-500" : "bg-gray-300"
                )}
              >
                <span className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                  isActive ? "translate-x-4.5" : "translate-x-0.5"
                )} />
              </button>
              <span className="text-sm">{isActive ? t("active") : t("inactive")}</span>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>{t("notes")}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPlaceholder")} maxLength={500} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>{t("cancel")}</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !dosage.trim() || !startDate || isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
