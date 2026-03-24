import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../components/language-switcher";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export const Route: any = createFileRoute("/sign-up")({
  component: SignUpPage,
});

const ROLES = ["patient", "doctor", "pharmacist", "ia_agent"] as const;
type Role = (typeof ROLES)[number];

function SignUpPage() {
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("patient");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const result = await (authClient.signUp.email as any)({
        name,
        email,
        password,
        role,
      });
      if (result?.error) {
        setError(result.error.message ?? "Sign-up failed");
      } else {
        navigate({ to: "/dashboard" as any });
      }
    } catch (err: any) {
      setError(err?.message ?? "Sign-up failed");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary">{t("appName")}</h1>
          <p className="text-muted-foreground mt-2">{t("appTagline")}</p>
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-5">
          <h2 className="text-xl font-semibold">{t("signUp.title")}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("signUp.name")}</Label>
              <Input
                id="name"
                type="text"
                placeholder={t("signUp.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("signUp.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("signUp.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("signUp.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label htmlFor="role">{t("signUp.role")}</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="" disabled>{t("signUp.selectRole")}</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? t("signUp.submitting") : t("signUp.submit")}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {t("signUp.haveAccount")}{" "}
            <Link to="/login" className="text-primary underline-offset-4 hover:underline">
              {t("signUp.signIn")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
