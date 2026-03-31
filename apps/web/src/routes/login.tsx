import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/language-switcher";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { AuthLeftPanel } from "../components/auth-left-panel";
import { Eye, EyeOff } from "lucide-react";

export const Route: any = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if ((result as any)?.error) {
        setError((result as any).error.message ?? "Sign-in failed");
      } else if ((result?.data as any)?.twoFactorRedirect) {
        navigate({ to: "/two-factor" as any });
      } else {
        navigate({ to: "/dashboard" as any });
      }
    } catch (err: any) {
      setError(err?.message ?? "Sign-in failed");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 min-h-screen">
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

          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-5">
            <h2 className="text-xl font-semibold">{t("login.title")}</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("login.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("login.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">{t("login.password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? t("login.submitting") : t("login.submit")}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              {t("login.noAccount")}{" "}
              <Link to="/sign-up" className="text-primary underline-offset-4 hover:underline">
                {t("login.signUp")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
