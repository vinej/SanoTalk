import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { SessionCard } from "../../components/sessions/session-card";
import { Plus, Kanban, LogOut } from "lucide-react";
import { TalkSession } from "@sanotalk/db";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../../components/language-switcher";
import { signOut } from "../../lib/auth-client";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

function transformSessionDates(session: any): TalkSession {
  return {
      ...session,
      id: session.id,
      hostId: session.hostId,
      roomName: session.roomName,
      status: session.status,
      scheduledAt: session.scheduledAt ? new Date(session.scheduledAt) : null,
      startedAt: session.startedAt ? new Date(session.startedAt) : null,
      endedAt: session.endedAt ? new Date(session.endedAt) : null,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
  };
}

function DashboardPage() {
  const { data: sessions, isLoading } = trpc.sessions.list.useQuery();
  const { t } = useTranslation(["dashboard", "common"]);
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate({ to: "/login" as any });
  }

  const sessionsWithDates = sessions?.map(transformSessionDates) ?? [];

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("dashboard:title")}</h1>
          <p className="text-muted-foreground mt-1">{t("dashboard:subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <LanguageSwitcher />
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            {t("common:logout")}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/kanban">
              <Kanban className="mr-2 h-4 w-4" />
              {t("common:kanban")}
            </Link>
          </Button>
          <Button asChild>
            <Link to="/sessions/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("dashboard:newSession")}
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessionsWithDates.map((session: TalkSession) => (
            <SessionCard key={session.id} session={session} />
          ))}
          {!sessions?.length && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              {t("dashboard:noSessions")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
