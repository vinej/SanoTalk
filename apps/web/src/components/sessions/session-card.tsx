import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "../../components/ui/dialog";
import { Calendar, Video, Trash2, Pencil, CircleCheck } from "lucide-react";
import { cn } from "../../lib/utils";
import { TalkSession } from "@sanotalk/db";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";

type Props = {
  session: TalkSession;
  readOnly?: boolean;
};

const statusColors = {
  scheduled: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
} as const;

export function SessionCard({ session, readOnly = false }: Props) {
  const { t } = useTranslation(["sessions", "common"]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState(session.title ?? "");
  const utils = trpc.useUtils();

  const deleteMutation = trpc.sessions.delete.useMutation({
    onSuccess: () => {
      void utils.sessions.list.invalidate();
      setConfirmOpen(false);
    },
  });

  const renameMutation = trpc.sessions.rename.useMutation({
    onSuccess: () => {
      void utils.sessions.list.invalidate();
      setRenameOpen(false);
    },
  });

  const closeMutation = trpc.sessions.end.useMutation({
    onSuccess: () => void utils.sessions.list.invalidate(),
  });

  const canClose = session.status === "scheduled" || session.status === "active";

  function handleRenameOpen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRenameTitle(session.title ?? "");
    setRenameOpen(true);
  }

  function handleRename() {
    if (!renameTitle.trim()) return;
    renameMutation.mutate({ id: session.id, title: renameTitle.trim() });
  }

  const displayTitle = session.title || session.roomName;

  return (
    <>
      <div className="relative group">
        {readOnly ? (
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base line-clamp-2">{displayTitle}</CardTitle>
                <Badge
                  variant="secondary"
                  className={cn("shrink-0 capitalize", statusColors[session.status])}
                >
                  {t(`sessions:card.statuses.${session.status}`)}
                </Badge>
              </div>
              <CardDescription className="text-xs truncate">
                {session.roomName}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              {session.scheduledAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(session.scheduledAt).toLocaleString()}
                </div>
              )}
              {session.status === "active" && (
                <div className="flex items-center gap-1 text-green-600 font-medium">
                  <Video className="h-3 w-3 animate-pulse" />
                  {t("sessions:card.liveNow")}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Link to="/sessions/$sessionId" params={{ sessionId: session.id }}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2 group-hover:text-primary transition-colors">
                      {displayTitle}
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className={cn("shrink-0 capitalize", statusColors[session.status])}
                    >
                      {t(`sessions:card.statuses.${session.status}`)}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs truncate">
                    {session.roomName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1">
                  {session.scheduledAt && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(session.scheduledAt).toLocaleString()}
                    </div>
                  )}
                  {session.status === "active" && (
                    <div className="flex items-center gap-1 text-green-600 font-medium">
                      <Video className="h-3 w-3 animate-pulse" />
                      {t("sessions:card.liveNow")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>

            {/* Close session button — only for scheduled/active */}
            {canClose && (
              <Button
                size="icon"
                variant="outline"
                className="absolute bottom-2 right-[4.5rem] h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-green-600 hover:text-green-700"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  closeMutation.mutate({ id: session.id });
                }}
                disabled={closeMutation.isPending}
                title={t("sessions:card.closeSession")}
              >
                <CircleCheck className="h-3.5 w-3.5" />
              </Button>
            )}

            {/* Rename button */}
            <Button
              size="icon"
              variant="outline"
              className="absolute bottom-2 right-10 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleRenameOpen}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>

            {/* Delete button */}
            <Button
              size="icon"
              variant="destructive"
              className="absolute bottom-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfirmOpen(true);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("sessions:card.renameTitle")}</DialogTitle>
            <DialogDescription>{session.roomName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <Label>{t("sessions:new.titleLabel")}</Label>
            <Input
              autoFocus
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              {t("common:cancel")}
            </Button>
            <Button
              onClick={handleRename}
              disabled={!renameTitle.trim() || renameMutation.isPending}
            >
              {t("common:save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sessions:card.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("sessions:card.deleteConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("common:cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate({ id: session.id })}
              disabled={deleteMutation.isPending}
            >
              {t("common:delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
