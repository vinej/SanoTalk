import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { cn } from "../../lib/utils";

type ConditionStatus = "active" | "managed" | "resolved";
type Severity = "mild" | "moderate" | "severe";

const STATUS_COLORS: Record<ConditionStatus, string> = {
  active: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  managed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const SEVERITY_COLORS: Record<Severity, string> = {
  mild: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  severe: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const COMMON_CONDITIONS = [
  "Type 1 Diabetes", "Type 2 Diabetes", "Asthma", "Hypertension", "COPD",
  "Heart Disease", "Arthritis", "Depression", "Anxiety", "Epilepsy",
  "Hypothyroidism", "Hyperthyroidism", "Crohn's Disease", "Celiac Disease",
  "Fibromyalgia", "Chronic Kidney Disease", "Lupus", "Multiple Sclerosis",
];

interface FormState {
  id?: string;
  name: string;
  status: ConditionStatus;
  severity: Severity;
  diagnosedDate: string;
  medications: string[];
  medInput: string;
  notes: string;
}

const EMPTY_FORM: FormState = { name: "", status: "active", severity: "moderate", diagnosedDate: "", medications: [], medInput: "", notes: "" };

export function ConditionList() {
  const { t } = useTranslation("allergies");
  const utils = trpc.useUtils();
  const { data: conditions = [] } = trpc.allergies.listConditions.useQuery();
  const addMutation = trpc.allergies.addCondition.useMutation({ onSuccess: () => { void utils.allergies.listConditions.invalidate(); setForm(null); } });
  const updateMutation = trpc.allergies.updateCondition.useMutation({ onSuccess: () => { void utils.allergies.listConditions.invalidate(); setForm(null); } });
  const deleteMutation = trpc.allergies.deleteCondition.useMutation({ onSuccess: () => void utils.allergies.listConditions.invalidate() });

  const [form, setForm] = useState<FormState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleSave() {
    if (!form || !form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      status: form.status,
      severity: form.severity,
      diagnosedDate: form.diagnosedDate || undefined,
      medications: form.medications.length > 0 ? form.medications : undefined,
      notes: form.notes || undefined,
    };
    if (form.id) {
      updateMutation.mutate({ id: form.id, ...payload });
    } else {
      addMutation.mutate(payload);
    }
  }

  function addMed() {
    if (!form || !form.medInput.trim()) return;
    setForm({ ...form, medications: [...form.medications, form.medInput.trim()], medInput: "" });
  }

  function removeMed(idx: number) {
    if (!form) return;
    setForm({ ...form, medications: form.medications.filter((_, i) => i !== idx) });
  }

  const availableSuggestions = form
    ? COMMON_CONDITIONS.filter((c) => !conditions.some((x) => x.name.toLowerCase() === c.toLowerCase()) && c.toLowerCase().includes(form.name.toLowerCase()))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("conditionsTitle")}</h2>
        {!form && (
          <Button size="sm" variant="outline" onClick={() => setForm({ ...EMPTY_FORM })}>
            <Plus className="h-3.5 w-3.5 mr-1" />{t("addCondition")}
          </Button>
        )}
      </div>

      {/* Add / Edit form */}
      {form && (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{form.id ? t("editCondition") : t("addCondition")}</p>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setForm(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("conditionName")}</Label>
            <Input className="h-8 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("conditionNamePlaceholder")} />
            {form.name.length > 0 && availableSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {availableSuggestions.slice(0, 6).map((s) => (
                  <button key={s} type="button" onClick={() => setForm({ ...form, name: s })} className="px-2 py-0.5 text-xs rounded-full border hover:bg-muted">{s}</button>
                ))}
              </div>
            )}
            {!form.name && (
              <div className="flex flex-wrap gap-1 mt-1">
                {COMMON_CONDITIONS.filter((c) => !conditions.some((x) => x.name === c)).slice(0, 8).map((s) => (
                  <button key={s} type="button" onClick={() => setForm({ ...form, name: s })} className="px-2 py-0.5 text-xs rounded-full border hover:bg-muted">{s}</button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("status")}</Label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as ConditionStatus })}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {(["active", "managed", "resolved"] as ConditionStatus[]).map((s) => (
                  <option key={s} value={s}>{t(`status_${s}`)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("severity")}</Label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {(["mild", "moderate", "severe"] as Severity[]).map((s) => (
                  <option key={s} value={s}>{t(`severity_${s}`)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("diagnosedDate")}</Label>
              <Input type="date" className="h-8 text-sm" value={form.diagnosedDate} onChange={(e) => setForm({ ...form, diagnosedDate: e.target.value })} />
            </div>
          </div>
          {/* Medications */}
          <div className="space-y-1">
            <Label className="text-xs">{t("linkedMedications")}</Label>
            {form.medications.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {form.medications.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-muted rounded-full">
                    {m}
                    <button type="button" onClick={() => removeMed(i)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm flex-1"
                value={form.medInput}
                onChange={(e) => setForm({ ...form, medInput: e.target.value })}
                placeholder={t("medicationPlaceholder")}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMed(); } }}
              />
              <Button size="sm" variant="outline" className="h-8" onClick={addMed} disabled={!form.medInput.trim()}>+</Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("notes")}</Label>
            <Input className="h-8 text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("notesPlaceholder")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setForm(null)}>{t("cancel")}</Button>
            <Button size="sm" onClick={handleSave} disabled={!form.name.trim() || addMutation.isPending || updateMutation.isPending}>
              {form.id ? t("save") : t("add")}
            </Button>
          </div>
        </div>
      )}

      {/* Condition list */}
      {conditions.length === 0 && !form && (
        <p className="text-sm text-muted-foreground italic py-4">{t("noConditions")}</p>
      )}
      <div className="space-y-1.5">
        {conditions.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
            <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full", STATUS_COLORS[c.status as ConditionStatus])}>{t(`status_${c.status}`)}</span>
            <span className="text-sm font-medium flex-1">{c.name}</span>
            <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full", SEVERITY_COLORS[c.severity as Severity])}>{t(`severity_${c.severity}`)}</span>
            {c.medications && c.medications.length > 0 && (
              <span className="text-xs text-muted-foreground hidden sm:inline">{c.medications.join(", ")}</span>
            )}
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setForm({
              id: c.id, name: c.name, status: c.status as ConditionStatus, severity: c.severity as Severity,
              diagnosedDate: c.diagnosedDate ?? "", medications: c.medications ?? [], medInput: "", notes: c.notes ?? "",
            })}>
              <Pencil className="h-3 w-3" />
            </Button>
            {confirmDeleteId === c.id ? (
              <div className="flex gap-1">
                <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={() => { deleteMutation.mutate({ id: c.id }); setConfirmDeleteId(null); }}>{t("confirm")}</Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirmDeleteId(null)}>{t("cancel")}</Button>
              </div>
            ) : (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setConfirmDeleteId(c.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
