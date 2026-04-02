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
import { Trash2, Pencil, X, Clock } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const PREDEFINED_KEYS = [
  "blood_type", "allergies", "chronic_conditions", "current_medications",
  "height", "weight", "bmi", "diet", "physical_activity", "smoking_status",
  "alcohol_consumption", "sleep_hours", "stress_level", "mood_baseline", "therapy_status",
  "city", "country", "region", "birth_date", "marital_status", "living_situation",
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
  const { t, i18n } = useTranslation(["profile", "common"]);
  const utils = trpc.useUtils();

  const { data: profile } = trpc.user.profile.useQuery(undefined, { enabled: open });

  const role = (profile as any)?.role as string | undefined;
  const isPatient = role === "patient";
  const isProfessional = role === "doctor" || role === "pharmacist";
  const isAdmin = role === "admin";

  // ── Professional-link queries ──────────────────────────────────────────────
  const { data: linkedUsers = [], refetch: refetchLinked } = trpc.user.listLinkedUsers.useQuery(
    undefined, { enabled: open && (isPatient || isProfessional) }
  );
  const linkedDoctors      = linkedUsers.filter((u) => (u as any)?.role === "doctor");
  const linkedPharmacists  = linkedUsers.filter((u) => (u as any)?.role === "pharmacist");
  const linkedPatients     = linkedUsers.filter((u) => (u as any)?.role === "patient");

  const { data: allDoctors = [] } = trpc.user.listByRole.useQuery(
    { role: "doctor" }, { enabled: open && isPatient }
  );
  const { data: allPharmacists = [] } = trpc.user.listByRole.useQuery(
    { role: "pharmacist" }, { enabled: open && isPatient }
  );
  const { data: allPatients = [] } = trpc.user.listByRole.useQuery(
    { role: "patient" }, { enabled: open && isProfessional }
  );

  // ── Sent pending requests ──────────────────────────────────────────────────
  const { data: sentPending = [], refetch: refetchSentPending } = trpc.user.listSentPendingRequests.useQuery(
    undefined, { enabled: open && (isPatient || isProfessional) }
  );

  const pendingLinkIds   = new Set(sentPending.filter((r) => r.type === "link").map((r) => r.toUserId));
  const pendingFriendIds = new Set(sentPending.filter((r) => r.type === "friend").map((r) => r.toUserId));

  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedPharmacistId, setSelectedPharmacistId] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");

  const linkedIds = new Set(linkedUsers.map((u) => (u as any)?.id));

  // Exclude already-linked AND pending
  const availableDoctors     = allDoctors.filter((u) => !linkedIds.has(u.id) && !pendingLinkIds.has(u.id));
  const availablePharmacists = allPharmacists.filter((u) => !linkedIds.has(u.id) && !pendingLinkIds.has(u.id));
  const availablePatients    = allPatients.filter((u) => !linkedIds.has(u.id) && !pendingLinkIds.has(u.id));

  // Pending link items per role
  const pendingDoctorItems     = sentPending.filter((r) => r.type === "link" && (r as any).toUser?.role === "doctor");
  const pendingPharmacistItems = sentPending.filter((r) => r.type === "link" && (r as any).toUser?.role === "pharmacist");
  const pendingPatientItems    = sentPending.filter((r) => r.type === "link" && (r as any).toUser?.role === "patient");

  const addLinkMutation = trpc.user.addUserLink.useMutation({
    onSuccess: () => {
      setSelectedDoctorId("");
      setSelectedPharmacistId("");
      setSelectedPatientId("");
      void refetchLinked();
      void refetchSentPending();
    },
  });
  const removeLinkMutation = trpc.user.removeUserLink.useMutation({
    onSuccess: () => void refetchLinked(),
  });
  const cancelRequestMutation = trpc.user.cancelRequest.useMutation({
    onSuccess: () => void refetchSentPending(),
  });

  // ── Friends ────────────────────────────────────────────────────────────────
  const { data: friends = [], refetch: refetchFriends } = trpc.user.listFriends.useQuery(
    undefined, { enabled: open }
  );
  const { data: allUsers = [] } = trpc.user.listAll.useQuery(undefined, { enabled: open });

  const [selectedFriendId, setSelectedFriendId] = useState("");

  const friendIds = new Set(friends.map((f) => (f as any)?.id));
  const availableFriends = allUsers.filter(
    (u) => u.id !== profile?.id && !friendIds.has(u.id) && !pendingFriendIds.has(u.id) &&
      (u.role === "patient" || u.role === "doctor" || u.role === "pharmacist")
  );

  // Pending friend items
  const pendingFriendItems = sentPending.filter((r) => r.type === "friend");

  const addFriendMutation = trpc.user.addFriend.useMutation({
    onSuccess: () => {
      setSelectedFriendId("");
      void refetchFriends();
      void refetchSentPending();
    },
  });
  const removeFriendMutation = trpc.user.removeFriend.useMutation({
    onSuccess: () => void refetchFriends(),
  });

  // ── Professional profile fields ────────────────────────────────────────────
  const [specialty, setSpecialty] = useState<string>("");
  const [licenseNumber, setLicenseNumber] = useState<string>("");
  const [saved, setSaved] = useState(false);

  // ── Properties ────────────────────────────────────────────────────────────
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
    if (isProfessional) {
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

          {/* Patient — linked doctors */}
          {isPatient && (
            <>
              <LinkedSection
                label={t("linkedDoctors")}
                emptyLabel={t("noLinkedDoctors")}
                linked={linkedDoctors}
                pending={pendingDoctorItems}
                available={availableDoctors}
                selectedId={selectedDoctorId}
                onSelectChange={setSelectedDoctorId}
                selectPlaceholder={t("selectDoctor")}
                onAdd={() => addLinkMutation.mutate({ targetUserId: selectedDoctorId })}
                onRemove={(id) => removeLinkMutation.mutate({ targetUserId: id })}
                onCancel={(targetUserId) => cancelRequestMutation.mutate({ targetUserId, type: "link" })}
                isPending={addLinkMutation.isPending || removeLinkMutation.isPending || cancelRequestMutation.isPending}
                pendingLabel={t("pending")}
                cancelLabel={t("cancelRequest")}
              />
              <LinkedSection
                label={t("linkedPharmacists")}
                emptyLabel={t("noLinkedPharmacists")}
                linked={linkedPharmacists}
                pending={pendingPharmacistItems}
                available={availablePharmacists}
                selectedId={selectedPharmacistId}
                onSelectChange={setSelectedPharmacistId}
                selectPlaceholder={t("selectPharmacist")}
                onAdd={() => addLinkMutation.mutate({ targetUserId: selectedPharmacistId })}
                onRemove={(id) => removeLinkMutation.mutate({ targetUserId: id })}
                onCancel={(targetUserId) => cancelRequestMutation.mutate({ targetUserId, type: "link" })}
                isPending={addLinkMutation.isPending || removeLinkMutation.isPending || cancelRequestMutation.isPending}
                pendingLabel={t("pending")}
                cancelLabel={t("cancelRequest")}
              />
            </>
          )}

          {/* Professional — specialty, license, linked patients */}
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
              <LinkedSection
                label={t("linkedPatients")}
                emptyLabel={t("noLinkedPatients")}
                linked={linkedPatients}
                pending={pendingPatientItems}
                available={availablePatients}
                selectedId={selectedPatientId}
                onSelectChange={setSelectedPatientId}
                selectPlaceholder={t("selectPatient")}
                onAdd={() => addLinkMutation.mutate({ targetUserId: selectedPatientId })}
                onRemove={(id) => removeLinkMutation.mutate({ targetUserId: id })}
                onCancel={(targetUserId) => cancelRequestMutation.mutate({ targetUserId, type: "link" })}
                isPending={addLinkMutation.isPending || removeLinkMutation.isPending || cancelRequestMutation.isPending}
                pendingLabel={t("pending")}
                cancelLabel={t("cancelRequest")}
              />
            </>
          )}

          {/* Friends (all roles except admin) */}
          {(isPatient || isProfessional) && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-medium">{t("friends")}</Label>
              {friends.length === 0 && pendingFriendItems.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">{t("noFriends")}</p>
              ) : (
                <ul className="space-y-1">
                  {friends.map((f) => (
                    <li key={(f as any)?.id} className="flex items-center justify-between text-sm bg-muted rounded px-2 py-1">
                      <span>{(f as any)?.name ?? (f as any)?.id}</span>
                      <span className="text-xs text-muted-foreground ml-2 capitalize">{(f as any)?.role}</span>
                      <button
                        onClick={() => removeFriendMutation.mutate({ friendId: (f as any).id })}
                        className="text-muted-foreground hover:text-destructive ml-2"
                        aria-label={t("removeFriend")}
                        disabled={removeFriendMutation.isPending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                  {pendingFriendItems.map((r) => {
                    const toUser = (r as any).toUser;
                    return (
                      <li key={r.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1 opacity-70">
                        <Clock className="h-3 w-3 text-muted-foreground shrink-0 mr-1" />
                        <span className="flex-1">{toUser?.name ?? r.toUserId}</span>
                        <span className="text-xs text-muted-foreground ml-2 italic">{t("pending")}</span>
                        <button
                          onClick={() => cancelRequestMutation.mutate({ targetUserId: r.toUserId, type: "friend" })}
                          className="text-muted-foreground hover:text-destructive ml-2 text-xs"
                          disabled={cancelRequestMutation.isPending}
                        >
                          {t("cancelRequest")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex gap-2">
                <select
                  value={selectedFriendId}
                  onChange={(e) => setSelectedFriendId(e.target.value)}
                  className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">{t("selectFriend")}</option>
                  {availableFriends.map((u) => (
                    <option key={u.id} value={u.id}>{u.name ?? u.id} ({u.role})</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addFriendMutation.mutate({ friendId: selectedFriendId })}
                  disabled={!selectedFriendId || addFriendMutation.isPending}
                >
                  {t("addFriend")}
                </Button>
              </div>
            </div>
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
                    <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs shrink-0">
                      {PREDEFINED_KEYS.includes(prop.key as any) ? t(`properties.keys.${prop.key}`) : prop.key}
                    </span>
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

            {/* Predefined key suggestions */}
            {(() => {
              const usedKeys = new Set(properties?.map((p) => p.key) ?? []);
              const available = PREDEFINED_KEYS.filter((k) => !usedKeys.has(k));
              return available.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {available.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setPropKey(tProps(`properties.keys.${key}`));
                        setPropValue(tProps(`properties.hints.${key}`));
                        setTimeout(() => propValueRef.current?.focus(), 0);
                      }}
                      className="px-2 py-0.5 text-xs rounded-full border border-input hover:bg-muted transition-colors"
                    >
                      {t(`properties.keys.${key}`)}
                    </button>
                  ))}
                </div>
              ) : null;
            })()}

            {/* Add new property */}
            <div className="flex gap-2">
              <Input
                className="h-8 text-xs"
                placeholder={t("properties.keyPlaceholder")}
                value={propKey}
                onChange={(e) => setPropKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddProperty(); }}
                maxLength={100}
              />
              <Input
                className="h-8 text-xs"
                placeholder={
                  propKey && PREDEFINED_KEYS.includes(propKey)
                    ? t(`properties.hints.${propKey}`)
                    : t("properties.valuePlaceholder")
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
            {t("common:cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isPending || saved || !isProfessional}>
            {saved ? t("saved") : isPending ? t("saving") : t("common:save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Shared linked-users section ────────────────────────────────────────────

function LinkedSection({
  label,
  emptyLabel,
  linked,
  pending,
  available,
  selectedId,
  onSelectChange,
  selectPlaceholder,
  onAdd,
  onRemove,
  onCancel,
  isPending,
  pendingLabel,
  cancelLabel,
}: {
  label: string;
  emptyLabel: string;
  linked: Array<any>;
  pending: Array<any>;
  available: Array<{ id: string; name?: string | null; specialty?: string | null }>;
  selectedId: string;
  onSelectChange: (id: string) => void;
  selectPlaceholder: string;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onCancel: (targetUserId: string) => void;
  isPending: boolean;
  pendingLabel: string;
  cancelLabel: string;
}) {
  return (
    <div className="space-y-2 pt-2 border-t">
      <Label className="text-sm font-medium">{label}</Label>
      {linked.length === 0 && pending.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1">
          {linked.map((u) => (
            <li key={u?.id} className="flex items-center justify-between text-sm bg-muted rounded px-2 py-1">
              <span>{u?.name ?? u?.id}{u?.specialty ? ` — ${u.specialty}` : ""}</span>
              <button
                onClick={() => onRemove(u.id)}
                className="text-muted-foreground hover:text-destructive ml-2"
                disabled={isPending}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {pending.map((r) => {
            const toUser = (r as any).toUser;
            return (
              <li key={r.id} className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1 opacity-70">
                <Clock className="h-3 w-3 text-muted-foreground shrink-0 mr-1" />
                <span className="flex-1">{toUser?.name ?? r.toUserId}{toUser?.specialty ? ` — ${toUser.specialty}` : ""}</span>
                <span className="text-xs text-muted-foreground ml-2 italic">{pendingLabel}</span>
                <button
                  onClick={() => onCancel(r.toUserId)}
                  className="text-muted-foreground hover:text-destructive ml-2 text-xs"
                  disabled={isPending}
                >
                  {cancelLabel}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-2">
        <select
          value={selectedId}
          onChange={(e) => onSelectChange(e.target.value)}
          className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">{selectPlaceholder}</option>
          {available.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.id}{u.specialty ? ` — ${u.specialty}` : ""}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          onClick={onAdd}
          disabled={!selectedId || isPending}
        >
          +
        </Button>
      </div>
    </div>
  );
}
