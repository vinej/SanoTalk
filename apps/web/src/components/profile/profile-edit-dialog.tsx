import { useState, useEffect } from "react";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProfileEditDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation("profile");
  const utils = trpc.useUtils();

  const { data: profile } = trpc.user.profile.useQuery(undefined, { enabled: open });

  const role = (profile as any)?.role as string | undefined;
  const isPatient = role === "patient";
  const isProfessional = role === "doctor" || role === "pharmacist";

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

  useEffect(() => {
    if (profile) {
      setLinkedDoctorId((profile as any).linkedDoctorId ?? "");
      setLinkedPharmacistId((profile as any).linkedPharmacistId ?? "");
      setSpecialty((profile as any).specialty ?? "");
      setLicenseNumber((profile as any).licenseNumber ?? "");
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
      <DialogContent className="sm:max-w-md">
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
