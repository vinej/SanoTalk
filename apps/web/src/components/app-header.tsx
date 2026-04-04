import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/button";
import { UserCircle, LogOut, Bell } from "lucide-react";
import { useAvatarUrl } from "../lib/avatar-url";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./language-switcher";
import { signOut } from "../lib/auth-client";
import { tracker } from "../lib/tracker";
import { SanoTalkLogoV2 } from "./logo-v2";
import { ProfileEditDialog } from "./profile/profile-edit-dialog";
import { ConnectionRequestsDialog } from "./profile/connection-requests-dialog";

export function AppHeader() {
  const { data: profile } = trpc.user.profile.useQuery();
  const { data: pendingRequests = [] } = trpc.user.listPendingRequests.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );
  const { t } = useTranslation(["dashboard", "common"]);
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const avatarUrl = useAvatarUrl(profile?.id, profile?.image);

  async function handleLogout() {
    if (tracker) {
      tracker.stop();
      console.log("[OpenReplay] tracker stopped");
    }
    await signOut();
    navigate({ to: "/login" as any });
  }

  const pendingCount = pendingRequests.length;

  return (
    <>
      <ProfileEditDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <ConnectionRequestsDialog open={requestsOpen} onOpenChange={setRequestsOpen} />
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b shrink-0">
        <Link to="/dashboard">
          <SanoTalkLogoV2 size={64} showText={true} />
        </Link>
        {profile && (
          <div className="text-sm grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-0">
            <span className="font-medium text-right">{profile.name}</span>
            <div className="flex gap-1">
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
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setProfileOpen(true)}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover mr-1" />
                ) : (
                  <UserCircle className="h-3 w-3 mr-1" />
                )}
                {t("dashboard:profile")}
              </Button>
            </div>
            <span className="text-muted-foreground text-right">{profile.email}</span>
            <LanguageSwitcher />
            <span className="text-muted-foreground capitalize text-right">{(profile as any).role}</span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={handleLogout}>
              <LogOut className="h-3 w-3 mr-1" />
              {t("common:logout")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
