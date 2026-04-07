import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { Printer, AlertTriangle } from "lucide-react";
import { useAvatarUrl, getInitials } from "../../lib/avatar-url";
import { cn } from "../../lib/utils";

const SEVERITY_ORDER = { life_threatening: 0, severe: 1, moderate: 2, mild: 3 } as Record<string, number>;

export function MedicalIdCard() {
  const { t } = useTranslation("allergies");
  const { data: profile } = trpc.user.profile.useQuery();
  const { data: allergies = [] } = trpc.allergies.listAllergies.useQuery();
  const { data: conditions = [] } = trpc.allergies.listConditions.useQuery();
  const { data: properties = [] } = trpc.user.listProperties.useQuery();
  const avatarUrl = useAvatarUrl(profile?.id, profile?.image);

  const bloodType = properties.find((p) => p.key === "blood_type" || p.key === "Groupe sanguin" || p.key === "Tipo de sangre" || p.key === "血型" || p.key === "فصيلة الدم" || p.key === "रक्त प्रकार")?.value;

  const drugAllergies = allergies
    .filter((a) => a.type === "drug")
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));

  const activeConditions = conditions.filter((c) => c.status === "active" || c.status === "managed");

  const hasContent = drugAllergies.length > 0 || activeConditions.length > 0 || bloodType;

  function handlePrint() {
    window.print();
  }

  if (!hasContent) {
    return (
      <div className="text-sm text-muted-foreground italic py-4">
        {t("medicalIdEmpty")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("medicalIdTitle")}</h2>
        <Button size="sm" variant="outline" onClick={handlePrint}>
          <Printer className="h-3.5 w-3.5 mr-1" />{t("print")}
        </Button>
      </div>

      <div className="rounded-xl border-2 border-red-300 dark:border-red-800 bg-white dark:bg-gray-950 p-5 space-y-4 max-w-md print:max-w-full print:border-red-500">
        {/* Header */}
        <div className="flex items-center gap-3 border-b pb-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover border" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-semibold border">
              {getInitials(profile?.name ?? "?")}
            </div>
          )}
          <div>
            <p className="font-bold text-lg">{profile?.name}</p>
            {bloodType && (
              <p className="text-sm"><span className="font-medium text-red-600">{t("bloodType")}:</span> {bloodType}</p>
            )}
          </div>
        </div>

        {/* Drug allergies */}
        {drugAllergies.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm font-bold uppercase">{t("drugAllergies")}</p>
            </div>
            {drugAllergies.map((a) => (
              <div key={a.id} className={cn(
                "px-3 py-1.5 rounded text-sm",
                a.severity === "life_threatening" || a.severity === "severe"
                  ? "bg-red-100 dark:bg-red-950 font-semibold"
                  : "bg-orange-50 dark:bg-orange-950/30"
              )}>
                <span className="font-medium">{a.name}</span>
                {a.reaction && <span className="text-muted-foreground"> — {a.reaction}</span>}
                <span className={cn(
                  "ml-2 text-[10px] font-medium uppercase",
                  a.severity === "life_threatening" ? "text-red-600" : a.severity === "severe" ? "text-orange-600" : "text-muted-foreground"
                )}>
                  ({t(`severity_${a.severity}`)})
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Active conditions */}
        {activeConditions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-bold uppercase text-muted-foreground">{t("activeConditions")}</p>
            {activeConditions.map((c) => (
              <div key={c.id} className="px-3 py-1.5 rounded bg-muted text-sm">
                <span className="font-medium">{c.name}</span>
                {c.medications && c.medications.length > 0 && (
                  <span className="text-muted-foreground text-xs ml-2">({c.medications.join(", ")})</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
