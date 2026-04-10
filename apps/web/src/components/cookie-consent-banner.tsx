import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { CookieSettingsDialog } from "./cookie-settings-dialog";
import { trpc } from "../lib/trpc";

const CONSENT_KEY = "sanotalk-cookie-consent";
// Salt for integrity hash — not a secret (client-side), just prevents casual tampering
const INTEGRITY_SALT = "sanotalk-consent-integrity-v1";

export type CookieConsent = {
  essential: boolean;
  analytics: boolean;
  decidedAt: string;
};

type StoredConsent = CookieConsent & { _hash: string };

/** Compute a simple SHA-256 hash of the consent payload for tamper detection. */
async function computeHash(consent: CookieConsent): Promise<string> {
  const data = `${INTEGRITY_SALT}:${consent.essential}:${consent.analytics}:${consent.decidedAt}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function getStoredConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed: StoredConsent = JSON.parse(raw);
    // Synchronous check — if hash is missing, treat as tampered and re-prompt
    if (!parsed._hash || !parsed.decidedAt) return null;
    return { essential: parsed.essential, analytics: parsed.analytics, decidedAt: parsed.decidedAt };
  } catch {
    return null;
  }
}

/** Async version that also verifies the integrity hash. */
export async function getVerifiedConsent(): Promise<CookieConsent | null> {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed: StoredConsent = JSON.parse(raw);
    if (!parsed._hash || !parsed.decidedAt) return null;
    const expected = await computeHash(parsed);
    if (parsed._hash !== expected) {
      // Tampered — clear and re-prompt
      localStorage.removeItem(CONSENT_KEY);
      return null;
    }
    return { essential: parsed.essential, analytics: parsed.analytics, decidedAt: parsed.decidedAt };
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return getStoredConsent()?.analytics === true;
}

export async function storeConsent(consent: CookieConsent) {
  const hash = await computeHash(consent);
  const stored: StoredConsent = { ...consent, _hash: hash };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(stored));
}

export function CookieConsentBanner() {
  const { t } = useTranslation("privacy");
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const recordConsent = trpc.privacy.recordConsent.useMutation();

  useEffect(() => {
    void getVerifiedConsent().then((c) => {
      if (!c) setVisible(true);
    });
  }, []);

  async function saveDecision(analytics: boolean) {
    const consent: CookieConsent = {
      essential: true,
      analytics,
      decidedAt: new Date().toISOString(),
    };
    await storeConsent(consent);
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
