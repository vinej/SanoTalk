import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "../../components/ui/button";
import { Kanban, Bot, Heart, Hospital, Download, Activity, Video, Pill, ClipboardList, UserCircle, ShieldAlert, FlaskConical, ShieldCheck, FlaskRound, Newspaper, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePwaInstall } from "../../hooks/use-pwa-install";
import { trpc } from "../../lib/trpc";
import { useAvatarUrl, getInitials } from "../../lib/avatar-url";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

const FEATURES = [
  { to: "/profile", icon: UserCircle, color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-950/30", border: "border-sky-200 dark:border-sky-800", key: "profile" },
  { to: "/health-help", icon: Hospital, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", key: "healthHelp" },
  { to: "/sessions", icon: Video, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800", key: "medicalConsultation" },
  { to: "/ai-assistant", icon: Bot, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", key: "aiAssistant" },
  { to: "/companion", icon: Heart, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800", key: "companion" },
  { to: "/pharmacist", icon: FlaskConical, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", key: "pharmacist" },
  { to: "/drug-info", icon: Search, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", key: "drugInfo" },
  { to: "/news", icon: Newspaper, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", key: "news" },
  { to: "/vitals", icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", key: "vitals" },
  { to: "/medications", icon: Pill, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/30", border: "border-rose-200 dark:border-rose-800", key: "medications" },
  { to: "/symptoms", icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", key: "symptoms" },
  { to: "/allergies", icon: ShieldAlert, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/30", border: "border-teal-200 dark:border-teal-800", key: "allergies" },
  { to: "/kanban", icon: Kanban, color: "text-gray-700", bg: "bg-gray-50 dark:bg-gray-950/30", border: "border-gray-200 dark:border-gray-800", key: "kanban" },
] as const;

function DashboardPage() {
  const { t } = useTranslation(["dashboard", "common"]);
  const { canInstall, install } = usePwaInstall();
  const { data: profile } = trpc.user.profile.useQuery();
  const avatarUrl = useAvatarUrl(profile?.id, profile?.image);

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("dashboard:title")}</h1>
        <p className="text-muted-foreground mt-1">{t("dashboard:subtitle")}</p>
      </div>

      {canInstall && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
          <div className="text-sm">
            <span className="font-medium">{t("dashboard:installApp")}</span>
            {" — "}
            <span className="text-muted-foreground">{t("dashboard:installAppDescription")}</span>
          </div>
          <Button size="sm" variant="outline" onClick={install}>
            <Download className="mr-2 h-3.5 w-3.5" />
            {t("dashboard:installButton")}
          </Button>
        </div>
      )}

      {profile?.role === "admin" && (
        <>
          <Link to="/admin-approvals" className="group">
            <div className="flex items-center gap-4 rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5 transition-shadow hover:shadow-md">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-900 shadow-sm">
                <ShieldCheck className="h-6 w-6 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold group-hover:underline">{t(`dashboard:adminApprovals`)}</p>
                <p className="text-sm text-muted-foreground">{t(`dashboard:adminApprovalsDesc`)}</p>
              </div>
            </div>
          </Link>
          <Link to="/test-ai" className="group">
            <div className="flex items-center gap-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/30 p-5 transition-shadow hover:shadow-md">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-900 shadow-sm">
                <FlaskRound className="h-6 w-6 text-gray-600" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold group-hover:underline">{t(`dashboard:testAi`)}</p>
                <p className="text-sm text-muted-foreground">{t(`dashboard:testAiDesc`)}</p>
              </div>
            </div>
          </Link>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Link key={f.key} to={f.to as any} className="group">
            <div className={`flex items-center gap-4 rounded-xl border-2 ${f.border} ${f.bg} p-5 transition-shadow hover:shadow-md`}>
              {f.key === "profile" ? (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-12 w-12 object-cover" />
                  ) : (
                    <span className="text-lg font-semibold text-sky-600">{getInitials(profile?.name ?? "?")}</span>
                  )}
                </div>
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-900 shadow-sm">
                  <f.icon className={`h-6 w-6 ${f.color}`} />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold group-hover:underline">{t(`dashboard:${f.key}`)}</p>
                <p className="text-sm text-muted-foreground">{t(`dashboard:${f.key}Desc`)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
