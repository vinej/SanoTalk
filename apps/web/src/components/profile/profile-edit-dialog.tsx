import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../ui/dialog";
import { Trash2, Pencil } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PREDEFINED_KEYS = [
  "blood_type", "allergies", "chronic_conditions", "current_medications",
  "height", "weight", "bmi", "diet", "physical_activity", "smoking_status",
  "alcohol_consumption", "sleep_hours", "stress_level", "mood_baseline", "therapy_status",
  "city", "country", "region", "birth_date",
];

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
];

export function ProfileEditDialog({ open, onOpenChange }: Props) {
  const { t, i18n } = useTranslation("profile");
  const utils = trpc.useUtils();

  const { data: profile } = trpc.user.profile.useQuery(undefined, { enabled: open });

  const role = (profile as any)?.role as string | undefined;
  const isPatient = role === "patient";
  const isProfessional = role === "doctor" || role === "pharmacist";
  const isAdmin = role === "admin";

  const { data: doctors } = trpc.user.listByRole.useQuery(
    { role: "doctor" },
    { enabled: open && isPatient }
  );
  const { data: pharmacists } = trpc.user.listByRole.useQuery(
    { role: "pharmacist" },
    { enabled: open && isPatient }
  );

  const [linkedDoctorId, setLinkedDoctorId] = useState<string>("");
  const [linkedPharmacistId, setLinkedPharmacistId] = useState<string>("");
  const [specialty, setSpecialty] = useState<string>("");
  const [licenseNumber, setLicenseNumber] = useState<string>("");
  const [saved, setSaved] = useState(false);

  const [propKey, setPropKey] = useState("");
  const [propValue, setPropValue] = useState("");
  const propValueRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [propertiesLanguage, setPropertiesLanguage] = useState(i18n.language);
  const tProps = i18n.getFixedT(propertiesLanguage, "profile");

  const { data: properties, refetch: refetchProperties } = trpc.user.listProperties.useQuery(
    undefined,
    { enabled: open }
  );

  const setPropertyMutation = trpc.user.setProperty.useMutation({
    onSuccess: () => {
      setPropKey("");
      setPropValue("");
      void refetchProperties();
    },
  });

  const setPropertiesLanguageMutation = trpc.user.setPropertiesLanguage.useMutation();

  const deletePropertyMutation = trpc.user.deleteProperty.useMutation({
    onSuccess: () => {
      setConfirmDeleteId(null);
      void refetchProperties();
    },
  });

  function handlePropertiesLanguageChange(lang: string) {
    setPropertiesLanguage(lang);
    setPropertiesLanguageMutation.mutate({ language: lang });
  }

  function handleAddProperty() {
    if (!propKey.trim() || !propValue.trim()) return;
    setPropertyMutation.mutate({ key: propKey.trim(), value: propValue.trim(), language: propertiesLanguage });
  }

  useEffect(() => {
    if (profile) {
      setLinkedDoctorId((profile as any).linkedDoctorId ?? "");
      setLinkedPharmacistId((profile as any).linkedPharmacistId ?? "");
      setSpecialty((profile as any).specialty ?? "");
      setLicenseNumber((profile as any).licenseNumber ?? "");
      setPropertiesLanguage((profile as any).propertiesLanguage ?? i18n.language);
      setSaved(false);
    }
  }, [profile]);

  const updateMutation = trpc.user.update.useMutation({
    onSuccess: () => {
      void utils.user.profile.invalidate();
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onOpenChange(false);
      }, 1200);
    },
  });

  function handleSave() {
    if (isPatient) {
      updateMutation.mutate({
        linkedDoctorId: linkedDoctorId || null,
        linkedPharmacistId: linkedPharmacistId || null,
      });
    } else if (isProfessional) {
      updateMutation.mutate({
        specialty: specialty || null,
        licenseNumber: licenseNumber || null,
      });
    }
  }

  const isPending = updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{profile?.name ?? ""}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Read-only fields */}
          <div className="space-y-1">
            <Label>{t("name")}</Label>
            <Input value={profile?.name ?? ""} disabled className="bg-muted" />
          </div>
          <div className="space-y-1">
            <Label>{t("email")}</Label>
            <Input value={profile?.email ?? ""} disabled className="bg-muted" />
          </div>

          {/* Admin notice */}
          {isAdmin && (
            <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
              {t("adminReadOnly")}
            </p>
          )}

          {/* Patient fields */}
          {isPatient && (
            <>
              <div className="space-y-1">
                <Label>{t("doctor")}</Label>
                <select
                  value={linkedDoctorId}
                  onChange={(e) => setLinkedDoctorId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">{t("noDoctor")}</option>
                  {doctors?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.specialty ? `— ${d.specialty}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>{t("pharmacist")}</Label>
                <select
                  value={linkedPharmacistId}
                  onChange={(e) => setLinkedPharmacistId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">{t("noPharmacist")}</option>
                  {pharmacists?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Doctor / Pharmacist fields */}
          {isProfessional && (
            <>
              <div className="space-y-1">
                <Label>{t("specialty")}</Label>
                <Input
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder={t("specialty")}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("licenseNumber")}</Label>
                <Input
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder={t("licenseNumber")}
                />
              </div>
            </>
          )}

          {/* Personal Context (key/value properties) */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">{t("properties.title")}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t("properties.description")}</p>
              </div>
              <div className="shrink-0 space-y-0.5">
                <Label className="text-xs text-muted-foreground">{t("properties.languageLabel")}</Label>
                <select
                  value={propertiesLanguage}
                  onChange={(e) => handlePropertiesLanguageChange(e.target.value)}
                  disabled={!!properties && properties.length > 0}
                  className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Existing properties */}
            {properties && properties.length > 0 ? (
              <ul className="space-y-1">
                {properties.map((prop) => (
                  <li key={prop.id} className="flex items-center gap-2 text-sm">
                    <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs shrink-0">{prop.key}</span>
                    <span className="flex-1 truncate text-muted-foreground">{prop.value}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() => { setPropKey(prop.key); setPropValue(prop.value); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {confirmDeleteId === prop.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-6 px-2 text-xs shrink-0"
                          onClick={() => deletePropertyMutation.mutate({ id: prop.id })}
                          disabled={deletePropertyMutation.isPending}
                        >
                          {t("properties.confirmDelete")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs shrink-0"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          {t("properties.cancelDelete")}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={() => setConfirmDeleteId(prop.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground italic">{t("properties.empty")}</p>
            )}

            {/* Predefined key suggestions — only show unused keys */}
            {(() => {
              const usedKeys = new Set(properties?.map((p) => p.key) ?? []);
              const available = PREDEFINED_KEYS.filter((k) => !usedKeys.has(k));
              return available.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {available.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => { setPropKey(key); setTimeout(() => propValueRef.current?.focus(), 0); }}
                      className="px-2 py-0.5 text-xs rounded-full border border-input hover:bg-muted transition-colors"
                    >
                      {tProps(`properties.keys.${key}`)}
                    </button>
                  ))}
                </div>
              ) : null;
            })()}

            {/* Add new property */}
            <div className="flex gap-2">
              <Input
                className="h-8 text-xs"
                placeholder={tProps("properties.keyPlaceholder")}
                value={propKey}
                onChange={(e) => setPropKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddProperty(); }}
                maxLength={100}
              />
              <Input
                className="h-8 text-xs"
                placeholder={
                  propKey && PREDEFINED_KEYS.includes(propKey)
                    ? tProps(`properties.hints.${propKey}`)
                    : tProps("properties.valuePlaceholder")
                }
                ref={propValueRef}
                value={propValue}
                onChange={(e) => setPropValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddProperty(); }}
                maxLength={1000}
              />
              <Button
                size="sm"
                className="h-8 px-3 text-xs shrink-0"
                onClick={handleAddProperty}
                disabled={!propKey.trim() || !propValue.trim() || setPropertyMutation.isPending}
              >
                {properties?.some((p) => p.key === propKey) ? t("properties.update") : t("properties.add")}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || saved || (!isPatient && !isProfessional)}>
            {saved ? t("saved") : isPending ? t("saving") : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
