import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { SessionCard } from "../../components/sessions/session-card";
import { Plus, Kanban, LogOut, UserCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../../components/ui/dialog";
import { TalkSession } from "@sanotalk/db";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../../components/language-switcher";
import { signOut } from "../../lib/auth-client";
import { tracker } from "../../lib/tracker";
import { SanoTalkLogoV2 } from "../../components/logo-v2";
import { ProfileEditDialog } from "../../components/profile/profile-edit-dialog";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

function transformSessionDates(session: any): TalkSession {
  return {
    ...session,
    scheduledAt: session.scheduledAt ? new Date(session.scheduledAt) : null,
    startedAt: session.startedAt ? new Date(session.startedAt) : null,
    endedAt: session.endedAt ? new Date(session.endedAt) : null,
    createdAt: new Date(session.createdAt),
    updatedAt: new Date(session.updatedAt),
  };
}

function DashboardPage() {
  const { data: sessions, isLoading } = trpc.sessions.list.useQuery();
  const { data: profile } = trpc.user.profile.useQuery();
  const { t } = useTranslation(["dashboard", "common", "sessions"]);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [profileOpen, setProfileOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const createSession = trpc.sessions.create.useMutation({
    onSuccess: (session) => {
      if (session) {
        void utils.sessions.list.invalidate();
        setNewSessionOpen(false);
        setNewTitle("");
        navigate({ to: `/sessions/${session.id}` as any });
      }
    },
  });

  async function handleLogout() {
    if (tracker) {
      tracker.stop();
      console.log("[OpenReplay] tracker stopped");
    }
    await signOut();
    navigate({ to: "/login" as any });
  }

  function handleNewSession() {
    if (!newTitle.trim()) return;
    createSession.mutate({ title: newTitle.trim() });
  }

  const sessionsWithDates = sessions?.map(transformSessionDates) ?? [];

  return (
    <>
      <ProfileEditDialog open={profileOpen} onOpenChange={setProfileOpen} />

      <Dialog open={newSessionOpen} onOpenChange={(v) => { setNewSessionOpen(v); if (!v) setNewTitle(""); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("sessions:new.title")}</DialogTitle>
            <DialogDescription>{t("sessions:new.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <Label>{t("sessions:new.titleLabel")}</Label>
            <Input
              autoFocus
              placeholder={t("sessions:new.titlePlaceholder")}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleNewSession(); }}
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSessionOpen(false)}>
              {t("common:cancel")}
            </Button>
            <Button onClick={handleNewSession} disabled={!newTitle.trim() || createSession.isPending}>
              {createSession.isPending ? t("sessions:new.creating") : t("sessions:new.start")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto py-8 space-y-6">
        <div className="relative flex items-center justify-center mb-2">
          <SanoTalkLogoV2 size={64} showText={true} />
          {profile && (
            <div className="absolute right-0 text-right text-sm leading-tight">
              <div className="font-medium">{profile.name}</div>
              <div className="text-muted-foreground">{profile.email}</div>
              <div className="text-muted-foreground capitalize">{(profile as any).role}</div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("dashboard:title")}</h1>
            <p className="text-muted-foreground mt-1">{t("dashboard:subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <LanguageSwitcher />
            <Button variant="outline" onClick={() => setProfileOpen(true)}>
              <UserCircle className="mr-2 h-4 w-4" />
              {t("dashboard:profile")}
            </Button>
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
            <Button onClick={() => setNewSessionOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("dashboard:newSession")}
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
    </>
  );
}
