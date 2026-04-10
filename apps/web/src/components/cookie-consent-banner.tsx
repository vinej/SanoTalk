import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { CookieSettingsDialog } from "./cookie-settings-dialog";
import { trpc } from "../lib/trpc";

const CONSENT_KEY = "sanotalk-cookie-consent";

export type CookieConsent = {
  essential: boolean;
  analytics: boolean;
  decidedAt: string;
};

export function getStoredConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return getStoredConsent()?.analytics === true;
}

function storeConsent(consent: CookieConsent) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
}

export function CookieConsentBanner() {
  const { t } = useTranslation("privacy");
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const recordConsent = trpc.privacy.recordConsent.useMutation();

  useEffect(() => {
    if (!getStoredConsent()) {
      setVisible(true);
    }
  }, []);

  function saveDecision(analytics: boolean) {
    const consent: CookieConsent = {
      essential: true,
      analytics,
      decidedAt: new Date().toISOString(),
    };
    storeConsent(consent);
    setVisible(false);

    // Record to DB (fire-and-forget for anonymous visitors)
    recordConsent.mutate({ consentType: "cookies", consented: true });
    recordConsent.mutate({ consentType: "analytics", consented: analytics });
  }

  if (!visible) return null;

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-card border-t shadow-lg">
        <div className="max-w-2xl mx-auto space-y-3">
          <h3 className="font-semibold text-sm">{t("consent.banner.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("consent.banner.description")}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => saveDecision(true)}>
              {t("consent.banner.acceptAll")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => saveDecision(false)}>
              {t("consent.banner.rejectAll")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowSettings(true)}>
              {t("consent.banner.managePreferences")}
            </Button>
          </div>
        </div>
      </div>

      <CookieSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        onSave={(analytics) => {
          saveDecision(analytics);
          setShowSettings(false);
        }}
      />
    </>
  );
}
