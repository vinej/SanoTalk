import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { ShieldCheck, ShieldAlert, FlaskRound, ArrowLeft } from "lucide-react";

export const Route: any = createFileRoute("/_auth/admin-panel")({
  component: AdminPanelPage,
});

const ADMIN_TILES = [
  {
    to: "/admin-approvals",
    icon: ShieldCheck,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    key: "adminApprovals",
  },
  {
    to: "/test-ai",
    icon: FlaskRound,
    color: "text-gray-600",
    bg: "bg-gray-50 dark:bg-gray-950/30",
    border: "border-gray-200 dark:border-gray-700",
    key: "testAi",
  },
  {
    to: "/admin-breaches",
    icon: ShieldAlert,
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    key: "breachRegister",
  },
] as const;

function AdminPanelPage() {
  const { t } = useTranslation(["dashboard", "common"]);
  const { data: profile } = trpc.user.profile.useQuery();

  if (profile?.role !== "admin") {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("dashboard:title")}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard:adminPanel")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("dashboard:adminPanelDesc")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_TILES.map((tile) => (
          <Link key={tile.key} to={tile.to as any} className="group">
            <div className={`flex items-center gap-4 rounded-xl border-2 ${tile.border} ${tile.bg} p-5 transition-shadow hover:shadow-md`}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-900 shadow-sm">
                <tile.icon className={`h-6 w-6 ${tile.color}`} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold group-hover:underline">{t(`dashboard:${tile.key}`)}</p>
                <p className="text-sm text-muted-foreground">{t(`dashboard:${tile.key}Desc`)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
