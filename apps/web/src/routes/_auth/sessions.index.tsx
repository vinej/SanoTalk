import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { SessionCard } from "../../components/sessions/session-card";
import { Plus } from "lucide-react";
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

export const Route = createFileRoute("/_auth/sessions/")({
  component: SessionsPage,
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

function SessionsPage() {
  const { data: sessions, isLoading } = trpc.sessions.list.useQuery();
  const { data: profile } = trpc.user.profile.useQuery();
  const { t, i18n } = useTranslation(["sessions", "common"]);
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
    const lang = (["en","fr","es","zh","ar","hi"].includes(i18n.language) ? i18n.language : "en") as "en"|"fr"|"es"|"zh"|"ar"|"hi";
    createSession.mutate({ title: newTitle.trim(), language: lang });
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("sessions:pageTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("sessions:pageSubtitle")}</p>
          </div>
          <Button onClick={() => setNewSessionOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("sessions:new.title")}
          </Button>
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
                {t("sessions:noSessions")}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
