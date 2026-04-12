import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback, type ComponentType, type ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Kanban, Bot, Heart, Hospital, Download, Activity, Video, Pill, ClipboardList, UserCircle, ShieldAlert, FlaskConical, ShieldCheck, FlaskRound, Newspaper, Search, MessageCircle, ChevronDown, Dumbbell, TreePine, CalendarDays, UtensilsCrossed } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePwaInstall } from "../../hooks/use-pwa-install";
import { trpc } from "../../lib/trpc";
import { useAvatarUrl, getInitials } from "../../lib/avatar-url";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

interface FeatureItem {
  to: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  border: string;
  key: string;
}

const STORAGE_KEY = "sanotalk-dashboard-panels";

function readPanelState(): Record<string, boolean> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writePanelState(state: Record<string, boolean>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded — ignore */ }
}

const PROFILE_ITEMS: FeatureItem[] = [
  { to: "/profile", icon: UserCircle, color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-950/30", border: "border-sky-200 dark:border-sky-800", key: "editProfile" },
  { to: "/vitals", icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", key: "vitals" },
  { to: "/medications", icon: Pill, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/30", border: "border-rose-200 dark:border-rose-800", key: "medications" },
  { to: "/symptoms", icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", key: "symptoms" },
  { to: "/allergies", icon: ShieldAlert, color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950/30", border: "border-teal-200 dark:border-teal-800", key: "allergies" },
];

const AI_ITEMS: FeatureItem[] = [
  { to: "/ai-assistant", icon: Bot, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", key: "aiAssistant" },
  { to: "/companion", icon: Heart, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800", key: "companion" },
  { to: "/pharmacist", icon: FlaskConical, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", key: "pharmacist" },
  { to: "/drug-info", icon: Search, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", key: "drugInfo" },
  { to: "/news", icon: Newspaper, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", key: "news" },
  { to: "/exercise-ai", icon: Dumbbell, color: "text-lime-600", bg: "bg-lime-50 dark:bg-lime-950/30", border: "border-lime-200 dark:border-lime-800", key: "exerciseAi" },
  { to: "/eat-well", icon: UtensilsCrossed, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", key: "eatWell" },
];

const ADMIN_ITEMS: FeatureItem[] = [
  { to: "/admin-approvals", icon: ShieldCheck, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", key: "adminApprovals" },
  { to: "/test-ai", icon: FlaskRound, color: "text-gray-600", bg: "bg-gray-50 dark:bg-gray-950/30", border: "border-gray-200 dark:border-gray-700", key: "testAi" },
  { to: "/admin-breaches", icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", key: "breachRegister" },
];

const HEALTH_HELP_ITEM: FeatureItem = { to: "/health-help", icon: Hospital, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", key: "healthHelp" };

const CONSULTATION_ITEMS: FeatureItem[] = [
  { to: "/friend-chat", icon: MessageCircle, color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-200 dark:border-pink-800", key: "friendChat" },
  { to: "/sessions", icon: Video, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800", key: "medicalConsultation" },
];

const EXERCISE_ITEMS: FeatureItem[] = [
  { to: "/train-body", icon: Dumbbell, color: "text-lime-600", bg: "bg-lime-50 dark:bg-lime-950/30", border: "border-lime-200 dark:border-lime-800", key: "trainBody" },
  { to: "/go-outside", icon: TreePine, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", key: "goOutside" },
];

const TASK_ITEMS: FeatureItem[] = [
  { to: "/kanban", icon: Kanban, color: "text-gray-700", bg: "bg-gray-50 dark:bg-gray-950/30", border: "border-gray-200 dark:border-gray-800", key: "kanban" },
  { to: "/agenda", icon: CalendarDays, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/30", border: "border-cyan-200 dark:border-cyan-800", key: "agenda" },
];

function DashboardPage() {
  const { t } = useTranslation(["dashboard", "common"]);
  const { canInstall, install } = usePwaInstall();
  const { data: profile } = trpc.user.profile.useQuery();
  const avatarUrl = useAvatarUrl(profile?.id, profile?.image);
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>(readPanelState);

  const togglePanel = useCallback((key: string) => {
    setOpenPanels((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writePanelState(next);
      return next;
    });
  }, []);

  return (
    <div className="px-6 py-6 space-y-6">
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

      {/* Groups */}
      <div className="space-y-4">
        {/* Health Help — same visual as group cards, red border */}
        <Link to={HEALTH_HELP_ITEM.to as any} className="block group">
          <div className={`flex items-center gap-3 rounded-lg border-2 ${HEALTH_HELP_ITEM.border} px-4 py-3 hover:bg-muted/50 transition-colors`}>
            <HEALTH_HELP_ITEM.icon className={`h-5 w-5 shrink-0 ${HEALTH_HELP_ITEM.color}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium group-hover:underline">{t(`dashboard:${HEALTH_HELP_ITEM.key}`)}</p>
              <p className="text-xs text-muted-foreground">{t(`dashboard:${HEALTH_HELP_ITEM.key}Desc`)}</p>
            </div>
          </div>
        </Link>
        {profile?.role === "admin" && (
          <ExpandableGroup
            icon={ShieldCheck}
            color="text-amber-600"
            bg="bg-amber-50 dark:bg-amber-950/30"
            border="border-amber-200 dark:border-amber-800"
            titleKey="adminPanel"
            isOpen={!!openPanels.admin}
            onToggle={() => togglePanel("admin")}
            items={ADMIN_ITEMS}
          />
        )}

        <ExpandableGroup
          icon={UserCircle}
          color="text-sky-600"
          bg="bg-sky-50 dark:bg-sky-950/30"
          border="border-sky-200 dark:border-sky-800"
          titleKey="profile"
          isOpen={!!openPanels.profile}
          onToggle={() => togglePanel("profile")}
          items={PROFILE_ITEMS}
          avatar={
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-12 w-12 object-cover" />
              ) : (
                <span className="text-lg font-semibold text-sky-600">{getInitials(profile?.name ?? "?")}</span>
              )}
            </div>
          }
        />

        <ExpandableGroup
          icon={Bot}
          color="text-blue-600"
          bg="bg-blue-50 dark:bg-blue-950/30"
          border="border-blue-200 dark:border-blue-800"
          titleKey="aiAssistants"
          isOpen={!!openPanels.ai}
          onToggle={() => togglePanel("ai")}
          items={AI_ITEMS}
        />

        <ExpandableGroup
          icon={MessageCircle}
          color="text-pink-600"
          bg="bg-pink-50 dark:bg-pink-950/30"
          border="border-pink-200 dark:border-pink-800"
          titleKey="consultations"
          isOpen={!!openPanels.consultations}
          onToggle={() => togglePanel("consultations")}
          items={CONSULTATION_ITEMS}
        />

        <ExpandableGroup
          icon={Dumbbell}
          color="text-lime-600"
          bg="bg-lime-50 dark:bg-lime-950/30"
          border="border-lime-200 dark:border-lime-800"
          titleKey="exercises"
          isOpen={!!openPanels.exercises}
          onToggle={() => togglePanel("exercises")}
          items={EXERCISE_ITEMS}
        />

        <ExpandableGroup
          icon={Kanban}
          color="text-gray-700"
          bg="bg-gray-50 dark:bg-gray-950/30"
          border="border-gray-200 dark:border-gray-800"
          titleKey="tasks"
          isOpen={!!openPanels.tasks}
          onToggle={() => togglePanel("tasks")}
          items={TASK_ITEMS}
        />
      </div>
    </div>
  );
}

function ExpandableGroup({
  icon: Icon,
  color,
  titleKey,
  isOpen,
  onToggle,
  items,
  avatar,
}: {
  icon: ComponentType<{ className?: string }>;
  color: string;
  bg?: string;
  border?: string;
  titleKey: string;
  isOpen: boolean;
  onToggle: () => void;
  items: FeatureItem[];
  avatar?: ReactNode;
}) {
  const { t } = useTranslation("dashboard");

  // When open: single-line collapse bar
  if (isOpen) {
    return (
      <div>
        <button onClick={onToggle} className="w-full text-left group">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2 hover:bg-muted/70 transition-colors">
            {avatar ? (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded overflow-hidden">
                {avatar}
              </div>
            ) : (
              <Icon className={`h-4 w-4 shrink-0 ${color}`} />
            )}
            <span className="text-sm font-medium flex-1">{t(titleKey)}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 rotate-180 transition-transform duration-200" />
          </div>
        </button>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3">
          {items.map((f) => (
            <Link key={f.key} to={f.to as any} className="group">
              <div className={`flex items-center gap-3 rounded-xl border ${f.border} ${f.bg} p-4 transition-shadow hover:shadow-md`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-gray-900 shadow-sm">
                  <f.icon className={`h-5 w-5 ${f.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold group-hover:underline">{t(f.key)}</p>
                  <p className="text-xs text-muted-foreground">{t(`${f.key}Desc`)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // When closed: compact group header (no colored bg, no large icon box)
  return (
    <button onClick={onToggle} className="w-full text-left group">
      <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:bg-muted/50 transition-colors">
        {avatar ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md overflow-hidden">
            {avatar}
          </div>
        ) : (
          <Icon className={`h-5 w-5 shrink-0 ${color}`} />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium group-hover:underline">{t(titleKey)}</p>
          <p className="text-xs text-muted-foreground">{t(`${titleKey}Desc`)}</p>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200" />
      </div>
    </button>
  );
}
