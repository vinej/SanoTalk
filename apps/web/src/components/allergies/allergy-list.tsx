import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { cn } from "../../lib/utils";

type AllergyType = "drug" | "food" | "environmental" | "other";
type Severity = "mild" | "moderate" | "severe" | "life_threatening";

const TYPE_COLORS: Record<AllergyType, string> = {
  drug: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  food: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  environmental: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const SEVERITY_COLORS: Record<Severity, string> = {
  mild: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  severe: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  life_threatening: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const COMMON_ALLERGIES: Record<AllergyType, string[]> = {
  drug: ["Penicillin", "Sulfa", "Aspirin", "Ibuprofen", "Codeine", "Latex"],
  food: ["Peanuts", "Tree nuts", "Shellfish", "Milk", "Eggs", "Wheat", "Soy", "Fish"],
  environmental: ["Pollen", "Dust mites", "Mold", "Pet dander", "Insect stings"],
  other: [],
};

interface FormState {
  id?: string;
  type: AllergyType;
  name: string;
  severity: Severity;
  reaction: string;
  diagnosedDate: string;
  notes: string;
}

const EMPTY_FORM: FormState = { type: "drug", name: "", severity: "moderate", reaction: "", diagnosedDate: "", notes: "" };

export function AllergyList() {
  const { t } = useTranslation("allergies");
  const utils = trpc.useUtils();
  const { data: allergies = [] } = trpc.allergies.listAllergies.useQuery();
  const addMutation = trpc.allergies.addAllergy.useMutation({ onSuccess: () => { void utils.allergies.listAllergies.invalidate(); setForm(null); } });
  const updateMutation = trpc.allergies.updateAllergy.useMutation({ onSuccess: () => { void utils.allergies.listAllergies.invalidate(); setForm(null); } });
  const deleteMutation = trpc.allergies.deleteAllergy.useMutation({ onSuccess: () => void utils.allergies.listAllergies.invalidate() });

  const [form, setForm] = useState<FormState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleSave() {
    if (!form || !form.name.trim()) return;
    const payload = {
      type: form.type,
      name: form.name.trim(),
      severity: form.severity,
      reaction: form.reaction || undefined,
      diagnosedDate: form.diagnosedDate || undefined,
      notes: form.notes || undefined,
    };
    if (form.id) {
      updateMutation.mutate({ id: form.id, ...payload });
    } else {
      addMutation.mutate(payload);
    }
  }

  // Group by type
  const grouped = allergies.reduce<Record<AllergyType, typeof allergies>>((acc, a) => {
    const key = a.type as AllergyType;
    (acc[key] ??= []).push(a);
    return acc;
  }, { drug: [], food: [], environmental: [], other: [] });

  const suggestions = form ? COMMON_ALLERGIES[form.type].filter(
    (s) => !allergies.some((a) => a.name.toLowerCase() === s.toLowerCase()) && s.toLowerCase().includes(form.name.toLowerCase())
  ) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("allergiesTitle")}</h2>
        {!form && (
          <Button size="sm" variant="outline" onClick={() => setForm({ ...EMPTY_FORM })}>
            <Plus className="h-3.5 w-3.5 mr-1" />{t("addAllergy")}
          </Button>
        )}
      </div>

      {/* Add / Edit form */}
      {form && (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{form.id ? t("editAllergy") : t("addAllergy")}</p>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setForm(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("type")}</Label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as AllergyType, name: "" })}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
              >
                {(["drug", "food", "environmental", "other"] as AllergyType[]).map((typ) => (
                  <option key={typ} value={typ}>{t(`type_${typ}`)}</option>
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
                {(["mild", "moderate", "severe", "life_threatening"] as Severity[]).map((s) => (
                  <option key={s} value={s}>{t(`severity_${s}`)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("allergyName")}</Label>
            <Input className="h-8 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("allergyNamePlaceholder")} />
            {suggestions.length > 0 && form.name.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {suggestions.slice(0, 6).map((s) => (
                  <button key={s} type="button" onClick={() => setForm({ ...form, name: s })} className="px-2 py-0.5 text-xs rounded-full border hover:bg-muted">{s}</button>
                ))}
              </div>
            )}
            {!form.name && COMMON_ALLERGIES[form.type].length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {COMMON_ALLERGIES[form.type].filter((s) => !allergies.some((a) => a.name === s)).map((s) => (
                  <button key={s} type="button" onClick={() => setForm({ ...form, name: s })} className="px-2 py-0.5 text-xs rounded-full border hover:bg-muted">{s}</button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("reaction")}</Label>
            <Input className="h-8 text-sm" value={form.reaction} onChange={(e) => setForm({ ...form, reaction: e.target.value })} placeholder={t("reactionPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("diagnosedDate")}</Label>
              <Input type="date" className="h-8 text-sm" value={form.diagnosedDate} onChange={(e) => setForm({ ...form, diagnosedDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("notes")}</Label>
              <Input className="h-8 text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("notesPlaceholder")} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setForm(null)}>{t("cancel")}</Button>
            <Button size="sm" onClick={handleSave} disabled={!form.name.trim() || addMutation.isPending || updateMutation.isPending}>
              {form.id ? t("save") : t("add")}
            </Button>
          </div>
        </div>
      )}

      {/* Grouped allergy list */}
      {allergies.length === 0 && !form && (
        <p className="text-sm text-muted-foreground italic py-4">{t("noAllergies")}</p>
      )}
      {(["drug", "food", "environmental", "other"] as AllergyType[]).map((typ) => {
        const items = grouped[typ];
        if (items.length === 0) return null;
        return (
          <div key={typ} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t(`type_${typ}`)}</h3>
            <div className="space-y-1.5">
              {items.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full", TYPE_COLORS[typ])}>{t(`type_${typ}`)}</span>
                  <span className="text-sm font-medium flex-1">{a.name}</span>
                  <span className={cn("px-2 py-0.5 text-[10px] font-medium rounded-full", SEVERITY_COLORS[a.severity as Severity])}>{t(`severity_${a.severity}`)}</span>
                  {a.reaction && <span className="text-xs text-muted-foreground hidden sm:inline">{a.reaction}</span>}
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setForm({
                    id: a.id, type: a.type as AllergyType, name: a.name, severity: a.severity as Severity,
                    reaction: a.reaction ?? "", diagnosedDate: a.diagnosedDate ?? "", notes: a.notes ?? "",
                  })}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {confirmDeleteId === a.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={() => { deleteMutation.mutate({ id: a.id }); setConfirmDeleteId(null); }}>{t("confirm")}</Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirmDeleteId(null)}>{t("cancel")}</Button>
                    </div>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setConfirmDeleteId(a.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
