import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/button";
import { LogOut, Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./language-switcher";
import { signOut } from "../lib/auth-client";
import { queryClient } from "../lib/query-client";
import { tracker } from "../lib/tracker";
import { SanoTalkLogoV2 } from "./logo-v2";
import { ConnectionRequestsDialog } from "./profile/connection-requests-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";

export function AppHeader() {
  const { data: profile } = trpc.user.profile.useQuery();
  const { data: aiInfo } = trpc.system.aiInfo.useQuery(undefined, { staleTime: Infinity });
  const { data: pendingRequests = [] } = trpc.user.listPendingRequests.useQuery(
    undefined,
    { refetchInterval: 30_000, staleTime: 0 }
  );
  const { t } = useTranslation(["dashboard", "common"]);
  const navigate = useNavigate();
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  async function handleLogout() {
    if (tracker) {
      tracker.stop();
    }
    queryClient.clear();
    sessionStorage.clear();
    // Clear service worker caches to remove any cached data
    if ("caches" in window) {
      caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
    }
    await signOut();
    navigate({ to: "/login" as any });
  }

  const pendingCount = pendingRequests.length;

  return (
    <>
      <ConnectionRequestsDialog open={requestsOpen} onOpenChange={setRequestsOpen} />
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b shrink-0">
        <Link to="/dashboard">
          <SanoTalkLogoV2 size={64} showText={true} />
        </Link>
        <span className="text-[10px] text-muted-foreground/60 font-mono">
          v{__APP_VERSION__}{aiInfo && <> powered by {aiInfo.model ?? aiInfo.provider}</>}
        </span>
        {profile && (
          <div className="text-sm grid grid-cols-[auto_auto_auto] items-center gap-x-3 gap-y-0 shrink-0">
            <span className="font-medium text-right">{profile.name}</span>
            <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 uppercase tracking-wide text-center">
              {t(`common:roles.${profile.role}`)}
            </span>
            <div className="flex gap-1 justify-end">
              <Button
                size="sm"
                variant="ghost"
                className="relative h-6 px-2 text-xs"
                onClick={() => setRequestsOpen(true)}
              >
                <Bell className="h-3 w-3 mr-1" />
                {t("dashboard:requests")}
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">
                    {pendingCount}
                  </span>
                )}
              </Button>
            </div>
            <span className="text-muted-foreground text-right">{profile.email}</span>
            <div className="flex justify-center">
              <LanguageSwitcher />
            </div>
            <div className="flex gap-1 justify-end">
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setLogoutOpen(true)}>
                <LogOut className="h-3 w-3 mr-1" />
                {t("common:logout")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common:logoutConfirm.title")}</DialogTitle>
            <DialogDescription>{t("common:logoutConfirm.desc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setLogoutOpen(false)}>
              {t("common:logoutConfirm.cancel")}
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="h-3 w-3 mr-1" />
              {t("common:logout")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
