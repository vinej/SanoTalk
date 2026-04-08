import { useState, useEffect, useRef, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Trash2, Pencil, X, Clock, Camera, Loader2 } from "lucide-react";
import { useAvatarUrl, getInitials } from "../../lib/avatar-url";
import { RamqSection } from "../../components/profile/ramq-section";

export const Route = createFileRoute("/_auth/profile")({
  component: ProfilePage,
});

const PREDEFINED_KEYS = [
  "blood_type", "allergies", "chronic_conditions", "current_medications",
  "height", "weight", "bmi", "diet", "physical_activity", "smoking_status",
  "alcohol_consumption", "sleep_hours", "stress_level", "mood_baseline", "therapy_status",
  "city", "country", "region", "birth_date", "marital_status", "living_situation",
  "ramq_number", "ramq_expiry",
];

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
];

function ProfilePage() {
  const { t, i18n } = useTranslation(["profile", "common"]);
  const utils = trpc.useUtils();

  const { data: profile } = trpc.user.profile.useQuery();

  const role = (profile as any)?.role as string | undefined;
  const isPatient = role === "patient";
  const isProfessional = role === "doctor" || role === "pharmacist";
  const isAdmin = role === "admin";

  // ── Professional-link queries ──────────────────────────────────────────────
  const { data: linkedUsers = [], refetch: refetchLinked } = trpc.user.listLinkedUsers.useQuery(
    undefined, { enabled: isPatient || isProfessional }
  );
  const linkedDoctors          = linkedUsers.filter((u) => (u as any)?.role === "doctor" && ((u as any)?.linkType ?? "doctor") === "doctor");
  const linkedWellnessDoctors  = linkedUsers.filter((u) => (u as any)?.role === "doctor" && (u as any)?.linkType === "wellness");
  const linkedPharmacists      = linkedUsers.filter((u) => (u as any)?.role === "pharmacist");
  const linkedPatients         = linkedUsers.filter((u) => (u as any)?.role === "patient");

  const { data: allDoctors = [] } = trpc.user.listByRole.useQuery(
    { role: "doctor" }, { enabled: isPatient }
  );
  const { data: allPharmacists = [] } = trpc.user.listByRole.useQuery(
    { role: "pharmacist" }, { enabled: isPatient }
  );
  const { data: allPatients = [] } = trpc.user.listByRole.useQuery(
    { role: "patient" }, { enabled: isProfessional }
  );

  // ── Sent pending requests ──────────────────────────────────────────────────
  const { data: sentPending = [], refetch: refetchSentPending } = trpc.user.listSentPendingRequests.useQuery(
    undefined, { enabled: isPatient || isProfessional }
  );

  const pendingFriendIds = new Set(sentPending.filter((r) => r.type === "friend").map((r) => r.toUserId));

  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedWellnessDoctorId, setSelectedWellnessDoctorId] = useState("");
  const [selectedPharmacistId, setSelectedPharmacistId] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState("");

  // IDs already linked as general doctors
  const linkedGeneralDoctorIds   = new Set(linkedDoctors.map((u) => (u as any)?.id));
  const linkedWellnessDoctorIds  = new Set(linkedWellnessDoctors.map((u) => (u as any)?.id));
  const linkedPharmacistIds      = new Set(linkedPharmacists.map((u) => (u as any)?.id));
  const linkedPatientIds         = new Set(linkedPatients.map((u) => (u as any)?.id));

  // Pending IDs per link type
  const pendingGeneralDoctorIds  = new Set(sentPending.filter((r) => r.type === "link" && (r as any).toUser?.role === "doctor" && ((r as any).linkType ?? "doctor") === "doctor").map((r) => r.toUserId));
  const pendingWellnessDoctorIds = new Set(sentPending.filter((r) => r.type === "link" && (r as any).toUser?.role === "doctor" && (r as any).linkType === "wellness").map((r) => r.toUserId));
  const pendingPharmacistLinkIds = new Set(sentPending.filter((r) => r.type === "link" && (r as any).toUser?.role === "pharmacist").map((r) => r.toUserId));
  const pendingPatientLinkIds    = new Set(sentPending.filter((r) => r.type === "link" && (r as any).toUser?.role === "patient").map((r) => r.toUserId));

  const availableDoctors          = allDoctors.filter((u) => !linkedGeneralDoctorIds.has(u.id) && !pendingGeneralDoctorIds.has(u.id));
  const availableWellnessDoctors  = allDoctors.filter((u) => !linkedWellnessDoctorIds.has(u.id) && !pendingWellnessDoctorIds.has(u.id));
  const availablePharmacists      = allPharmacists.filter((u) => !linkedPharmacistIds.has(u.id) && !pendingPharmacistLinkIds.has(u.id));
  const availablePatients         = allPatients.filter((u) => !linkedPatientIds.has(u.id) && !pendingPatientLinkIds.has(u.id));

  const pendingDoctorItems          = sentPending.filter((r) => r.type === "link" && (r as any).toUser?.role === "doctor" && ((r as any).linkType ?? "doctor") === "doctor");
  const pendingWellnessDoctorItems  = sentPending.filter((r) => r.type === "link" && (r as any).toUser?.role === "doctor" && (r as any).linkType === "wellness");
  const pendingPharmacistItems      = sentPending.filter((r) => r.type === "link" && (r as any).toUser?.role === "pharmacist");
  const pendingPatientItems         = sentPending.filter((r) => r.type === "link" && (r as any).toUser?.role === "patient");

  const addLinkMutation = trpc.user.addUserLink.useMutation({
    onSuccess: () => {
      setSelectedDoctorId("");
      setSelectedWellnessDoctorId("");
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
  const { data: friends = [], refetch: refetchFriends } = trpc.user.listFriends.useQuery();
  const { data: allUsers = [] } = trpc.user.listAll.useQuery();

  const [selectedFriendId, setSelectedFriendId] = useState("");

  const friendIds = new Set(friends.map((f) => (f as any)?.id));
  const availableFriends = allUsers.filter(
    (u) => u.id !== profile?.id && !friendIds.has(u.id) && !pendingFriendIds.has(u.id) &&
      (u.role === "patient" || u.role === "doctor" || u.role === "pharmacist")
  );

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

  // ── Profile photo ──────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const avatarUrl = useAvatarUrl(profile?.id, profile?.image);

  const uploadAvatarMutation = trpc.storage.uploadAvatar.useMutation({
    onSuccess: () => void utils.user.profile.invalidate(),
  });
  const updateImageMutation = trpc.user.updateImage.useMutation({
    onSuccess: () => void utils.user.profile.invalidate(),
  });

  async function handlePhotoUpload(file: File) {
    const contentType = file.type as "image/jpeg" | "image/png" | "image/webp";
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) return;
    if (file.size > 5 * 1024 * 1024) return;

    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      await uploadAvatarMutation.mutateAsync({ base64, contentType });
    } catch {
      // upload failed silently
    } finally {
      setUploading(false);
    }
  }

  function handleRemovePhoto() {
    updateImageMutation.mutate({ image: null });
  }

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

  const { data: properties, refetch: refetchProperties } = trpc.user.listProperties.useQuery();

  const showRamqSection = useMemo(() => {
    if (!properties) return false;
    if (properties.some((p) => p.key === "ramq_number" || p.key === "ramq_expiry")) return true;
    const region = properties.find((p) => p.key === "region")?.value ?? "";
    return /qu[eé]bec/i.test(region);
  }, [properties]);

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

  function handlePropertiesLanguageChange(lang: "en" | "fr" | "es" | "zh" | "ar" | "hi") {
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
      setTimeout(() => setSaved(false), 1200);
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
    <div className="flex-1 flex flex-col min-h-0 px-6 py-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{profile?.name ?? ""}</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Profile photo */}
        {!isAdmin && (
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={profile?.name ?? ""}
                  className="h-20 w-20 rounded-full object-cover border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-xl font-semibold text-muted-foreground border">
                  {getInitials(profile?.name ?? "?")}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm">{t("photo.label")}</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" />{t("photo.uploading")}</>
                  ) : (
                    <><Camera className="h-3 w-3 mr-1" />{t("photo.upload")}</>
                  )}
                </Button>
                {profile?.image && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive"
                    onClick={handleRemovePhoto}
                    disabled={uploading}
                  >
                    {t("photo.remove")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("photo.maxSize")}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handlePhotoUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        )}

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
              label={t("linkedWellnessDoctors")}
              emptyLabel={t("noLinkedWellnessDoctors")}
              linked={linkedWellnessDoctors}
              pending={pendingWellnessDoctorItems}
              available={availableWellnessDoctors}
              selectedId={selectedWellnessDoctorId}
              onSelectChange={setSelectedWellnessDoctorId}
              selectPlaceholder={t("selectWellnessDoctor")}
              onAdd={() => addLinkMutation.mutate({ targetUserId: selectedWellnessDoctorId, linkType: "wellness" })}
              onRemove={(id) => removeLinkMutation.mutate({ targetUserId: id, linkType: "wellness" })}
              onCancel={(targetUserId) => cancelRequestMutation.mutate({ targetUserId, type: "link", linkType: "wellness" })}
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

        {/* Save button for professionals */}
        {isProfessional && (
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isPending || saved}>
              {saved ? t("saved") : isPending ? t("saving") : t("common:save")}
            </Button>
          </div>
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

        {/* RAMQ Health Insurance (Quebec patients) */}
        {isPatient && showRamqSection && (
          <RamqSection properties={properties ?? []} onPropertyChange={refetchProperties} />
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
                onChange={(e) => handlePropertiesLanguageChange(e.target.value as "en" | "fr" | "es" | "zh" | "ar" | "hi")}
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
    </div>
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
