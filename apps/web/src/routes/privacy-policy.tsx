import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/language-switcher";
import { Shield, ArrowLeft, Mail } from "lucide-react";

export const Route: any = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
});

const SECTION_KEYS = [
  "dataCollected",
  "purposes",
  "retention",
  "thirdPartyAccess",
  "userRights",
  "howToExerciseRights",
  "privacyOfficer",
  "aiTransparency",
  "cookies",
  "changes",
] as const;

function PrivacyPolicyPage() {
  const { t } = useTranslation("privacy");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common:login.title", "Login")}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">{t("title")}</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">{t("lastUpdated")}</p>

        <div className="space-y-8">
          {SECTION_KEYS.map((key) => (
            <section key={key} className="space-y-3">
              <h2 className="text-xl font-semibold border-b pb-2">
                {t(`sections.${key}.title`)}
              </h2>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line prose prose-sm dark:prose-invert max-w-none">
                {t(`sections.${key}.body`)}
              </div>

              {/* Privacy officer contact info */}
              {key === "privacyOfficer" && (
                <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{t("privacyOfficerName")}</p>
                    <a
                      href={`mailto:${t("privacyOfficerEmail")}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {t("privacyOfficerEmail")}
                    </a>
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
