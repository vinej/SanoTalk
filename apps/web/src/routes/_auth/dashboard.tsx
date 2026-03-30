import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { SessionCard } from "../../components/sessions/session-card";
import { Plus, Kanban, Bot, Heart, Newspaper } from "lucide-react";
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
  const { t, i18n } = useTranslation(["dashboard", "common", "sessions"]);
  const navigate = useNavigate();
  const utils = trpc.useUtils();
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

  function handleNewSession() {
    if (!newTitle.trim()) return;
    createSession.mutate({ title: newTitle.trim(), language: i18n.language });
  }

  const isAdmin = (profile as any)?.role === "admin";
  const sessionsWithDates = sessions?.map(transformSessionDates) ?? [];

  return (
    <>
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

      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("dashboard:title")}</h1>
            <p className="text-muted-foreground mt-1">{t("dashboard:subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/companion">
                <Heart className="mr-2 h-4 w-4 text-rose-500" />
                {t("dashboard:companion")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/ai-assistant">
                <Bot className="mr-2 h-4 w-4" />
                {t("dashboard:aiAssistant")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/news">
                <Newspaper className="mr-2 h-4 w-4 text-amber-600" />
                {t("dashboard:newsAgent")}
              </Link>
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
              <SessionCard key={session.id} session={session} readOnly={isAdmin} />
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
