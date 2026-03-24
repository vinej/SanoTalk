import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard, AuthUIProvider } from "@daveyplate/better-auth-ui";
import { authClient } from "../lib/auth-client";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/language-switcher";

export const Route: any = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  return (
    <AuthUIProvider
      authClient={authClient}
      navigate={(href) => navigate({ to: href as any })}
      basePath=""
      viewPaths={{ signIn: "login", signUp: "sign-up" }}
    >
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-md px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary">{t("appName")}</h1>
            <p className="text-muted-foreground mt-2">{t("appTagline")}</p>
          </div>
          <AuthCard
            pathname="/login"
            redirectTo="/dashboard"
          />
        </div>
      </div>
    </AuthUIProvider>
  );
}
