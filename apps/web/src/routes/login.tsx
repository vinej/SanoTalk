import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthCard, AuthUIProvider } from "@daveyplate/better-auth-ui";
import { authClient } from "../lib/auth-client";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/language-switcher";
import { AuthLeftPanel } from "../components/auth-left-panel";

export const Route: any = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation(["common", "auth"]);

  const localization = {
    signIn:                 t("auth:authCard.signIn"),
    signUp:                 t("auth:authCard.signUp"),
    signInAction:           t("auth:authCard.signInAction"),
    signUpAction:           t("auth:authCard.signUpAction"),
    email:                  t("auth:authCard.email"),
    password:               t("auth:authCard.password"),
    confirmPassword:        t("auth:authCard.confirmPassword"),
    signInDescription:      t("auth:authCard.signInDescription"),
    signUpDescription:      t("auth:authCard.signUpDescription"),
    forgotPasswordLink:     t("auth:authCard.forgotPasswordLink"),
    forgotPasswordAction:   t("auth:authCard.forgotPasswordAction"),
    forgotPasswordDescription: t("auth:authCard.forgotPasswordDescription"),
    dontHaveAnAccount:      t("auth:authCard.dontHaveAnAccount"),
    alreadyHaveAnAccount:   t("auth:authCard.alreadyHaveAnAccount"),
    invalidEmailOrPassword: t("auth:authCard.invalidEmailOrPassword"),
    emailRequired:          t("auth:authCard.emailRequired"),
    passwordRequired:       t("auth:authCard.passwordRequired"),
    passwordsDoNotMatch:    t("auth:authCard.passwordsDoNotMatch"),
    error:                  t("auth:authCard.error"),
  };

  return (
    <AuthUIProvider
      authClient={authClient}
      navigate={(href) => navigate({ to: href as any })}
      basePath=""
      viewPaths={{ signIn: "login", signUp: "sign-up" }}
      localization={localization}
    >
      <div className="min-h-screen grid lg:grid-cols-2">
        <AuthLeftPanel />

        {/* Right panel */}
        <div className="flex flex-col items-center justify-center px-6 py-10 bg-background relative">
          <div className="absolute top-4 right-4">
            <LanguageSwitcher />
          </div>
          <div className="w-full max-w-sm">
            <div className="text-center mb-8 lg:hidden">
              <h1 className="text-3xl font-bold text-primary">{t("appName")}</h1>
              <p className="text-muted-foreground mt-1 text-sm">{t("appTagline")}</p>
            </div>
            <AuthCard
              pathname="/login"
              redirectTo="/dashboard"
            />
          </div>
        </div>
      </div>
    </AuthUIProvider>
  );
}
