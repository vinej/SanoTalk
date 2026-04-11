import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { MailCheck, MailX, Loader2 } from "lucide-react";

const searchSchema = z.object({
  token: z.string(),
});

export const Route = createFileRoute("/verify-email")({
  validateSearch: searchSchema,
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const { t } = useTranslation("common");
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    authClient.verifyEmail({ query: { token } })
      .then(({ error }) => {
        if (error) {
          setErrorMessage("Verification failed. The link may have expired — please request a new one.");
          setStatus("error");
        } else {
          setStatus("success");
        }
      })
      .catch(() => {
        setErrorMessage("An unexpected error occurred.");
        setStatus("error");
      });
  }, [token]);

  async function handleResend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResendStatus("sending");
    const { error } = await authClient.sendVerificationEmail({ email: resendEmail, callbackURL: "/verify-email" });
    if (error) {
      setResendStatus("error");
    } else {
      setResendStatus("sent");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <div className="text-center space-y-4 max-w-md px-4">
        {status === "verifying" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto" />
            <h1 className="text-2xl font-bold">{t("verifyEmail.verifying")}</h1>
            <p className="text-muted-foreground">{t("verifyEmail.verifyingDesc")}</p>
          </>
        )}

        {status === "success" && (
          <>
            <MailCheck className="h-12 w-12 text-green-600 mx-auto" />
            <h1 className="text-2xl font-bold text-green-600">{t("verifyEmail.success")}</h1>
            <p className="text-muted-foreground">{t("verifyEmail.successDesc")}</p>
            <Link to="/login" className="text-primary underline text-sm block mt-2">
              {t("verifyEmail.backToLogin")}
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <MailX className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-destructive">{t("verifyEmail.failed")}</h1>
            <p className="text-muted-foreground">{errorMessage}</p>

            <div className="pt-2 space-y-3 text-left">
              <p className="text-sm font-medium text-center">{t("verifyEmail.resendTitle")}</p>
              {resendStatus === "sent" ? (
                <p className="text-sm text-green-600 text-center">{t("verifyEmail.resendSent")}</p>
              ) : (
                <form onSubmit={handleResend} className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                  />
                  <Button type="submit" disabled={resendStatus === "sending"}>
                    {resendStatus === "sending" ? t("verifyEmail.resending") : t("verifyEmail.resend")}
                  </Button>
                </form>
              )}
              {resendStatus === "error" && (
                <p className="text-sm text-destructive text-center">{t("verifyEmail.resendError")}</p>
              )}
            </div>

            <Link to="/login" className="text-primary underline text-sm block">
              {t("verifyEmail.backToLogin")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
