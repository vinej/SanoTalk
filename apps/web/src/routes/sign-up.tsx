import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { useTranslation, Trans } from "react-i18next";
import { LanguageSwitcher } from "../components/language-switcher";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { AuthLeftPanel } from "../components/auth-left-panel";
import { Eye, EyeOff, MailCheck } from "lucide-react";

export const Route: any = createFileRoute("/sign-up")({
  component: SignUpPage,
});

const ROLES = ["patient", "doctor", "pharmacist"] as const;
type Role = (typeof ROLES)[number];

function SignUpPage() {
  const { t } = useTranslation("common");
  const { t: tp } = useTranslation("privacy");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<Role>("patient");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t("signUp.passwordMismatch"));
      return;
    }
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
        setSubmitted(true);
      }
    } catch (err: any) {
      setError(err?.message ?? "Sign-up failed");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 min-h-screen">
      <AuthLeftPanel />

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
            {submitted ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <MailCheck className="h-12 w-12 text-primary" />
                <h2 className="text-xl font-semibold">{t("signUp.verifyTitle")}</h2>
                <p className="text-sm text-muted-foreground">
                  <Trans
                    i18nKey="signUp.verifyMessage"
                    ns="common"
                    values={{ email }}
                    components={{ strong: <strong className="text-foreground" /> }}
                  />
                </p>
                <Link to="/login" className="w-full mt-2">
                  <Button variant="outline" className="w-full">{t("signUp.verifyGoToLogin")}</Button>
                </Link>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold">{t("signUp.title")}</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
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

                  <div className="space-y-1.5">
                    <Label htmlFor="password">{t("signUp.password")}</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="new-password"
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

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">{t("signUp.confirmPassword")}</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        className="pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

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

                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptedPrivacy}
                      onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                      required
                    />
                    <span className="text-muted-foreground">
                      <Trans
                        i18nKey="signUp.acceptPrivacy"
                        ns="privacy"
                        components={{
                          link: (
                            <Link
                              to="/privacy-policy"
                              target="_blank"
                              className="text-primary underline-offset-4 hover:underline"
                            />
                          ),
                        }}
                      />
                    </span>
                  </label>

                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={isPending || !acceptedPrivacy}>
                    {isPending ? t("signUp.submitting") : t("signUp.submit")}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground">
                  {t("signUp.haveAccount")}{" "}
                  <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                    {t("signUp.signIn")}
                  </Link>
                </p>
              </>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            <Link to="/privacy-policy" className="hover:underline underline-offset-4">
              {tp("footer.privacyPolicy")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
