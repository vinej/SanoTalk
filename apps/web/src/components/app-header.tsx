import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/button";
import { UserCircle, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./language-switcher";
import { signOut } from "../lib/auth-client";
import { tracker } from "../lib/tracker";
import { SanoTalkLogoV2 } from "./logo-v2";
import { ProfileEditDialog } from "./profile/profile-edit-dialog";

export function AppHeader() {
  const { data: profile } = trpc.user.profile.useQuery();
  const { t } = useTranslation(["dashboard", "common"]);
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  async function handleLogout() {
    if (tracker) {
      tracker.stop();
      console.log("[OpenReplay] tracker stopped");
    }
    await signOut();
    navigate({ to: "/login" as any });
  }

  return (
    <>
      <ProfileEditDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b shrink-0">
        <Link to="/dashboard">
          <SanoTalkLogoV2 size={64} showText={true} />
        </Link>
        {profile && (
          <div className="text-sm grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-0">
            <span className="font-medium text-right">{profile.name}</span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setProfileOpen(true)}>
              <UserCircle className="h-3 w-3 mr-1" />
              {t("dashboard:profile")}
            </Button>
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
