import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CookieSettingsDialog } from "./cookie-settings-dialog";
import { storeConsent } from "./cookie-consent-banner";
import { tracker } from "../lib/tracker";

export function PrivacyFooter() {
  const { t } = useTranslation("privacy");
  const [showSettings, setShowSettings] = useState(false);

  async function handleSaveCookieSettings(analytics: boolean) {
    await storeConsent({
      essential: true,
      analytics,
      decidedAt: new Date().toISOString(),
    });
    setShowSettings(false);
    // Stop the tracker immediately before reload to prevent data leakage
    if (!analytics) {
      if (tracker) tracker.stop();
      window.location.reload();
    }
  }

  return (
    <>
      <footer className="border-t bg-muted/30 px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <Link to="/privacy-policy" className="hover:underline underline-offset-4">
            {t("footer.privacyPolicy")}
          </Link>
          <span className="hidden sm:inline">|</span>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="hover:underline underline-offset-4"
          >
            {t("footer.manageCookies")}
          </button>
          <span className="hidden sm:inline">|</span>
          <a href={`mailto:${t("privacyOfficerEmail")}`} className="hover:underline underline-offset-4">
            {t("footer.privacyOfficer")}
          </a>
        </div>
      </footer>

      <CookieSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        onSave={handleSaveCookieSettings}
      />
    </>
  );
}
