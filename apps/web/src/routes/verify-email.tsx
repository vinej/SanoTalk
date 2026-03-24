import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const searchSchema = z.object({
  token: z.string(),
});

export const Route = createFileRoute("/verify-email")({
  validateSearch: searchSchema,
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    authClient.verifyEmail({ query: { token } })
      .then(({ error }) => {
        if (error) {
          setErrorMessage(error.message ?? "Verification failed.");
          setStatus("error");
        } else {
          setStatus("success");
          setTimeout(() => navigate({ to: "/dashboard" as any }), 2000);
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
    const { error } = await authClient.sendVerificationEmail({ email: resendEmail, callbackURL: "/dashboard" });
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
            <h1 className="text-2xl font-bold">Verifying your email…</h1>
            <p className="text-muted-foreground">Please wait.</p>
          </>
        )}
        {status === "success" && (
          <>
            <h1 className="text-2xl font-bold text-green-600">Email verified!</h1>
            <p className="text-muted-foreground">Redirecting you to the dashboard…</p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-2xl font-bold text-destructive">Verification failed</h1>
            <p className="text-muted-foreground">{errorMessage}</p>

            <div className="pt-2 space-y-3 text-left">
              <p className="text-sm font-medium text-center">Resend verification email</p>
              {resendStatus === "sent" ? (
                <p className="text-sm text-green-600 text-center">Verification email sent — check your inbox.</p>
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
                    {resendStatus === "sending" ? "Sending…" : "Resend"}
                  </Button>
                </form>
              )}
              {resendStatus === "error" && (
                <p className="text-sm text-destructive text-center">Failed to send — check your email address.</p>
              )}
            </div>

            <a href="/login" className="text-primary underline text-sm block">
              Back to login
            </a>
          </>
        )}
      </div>
    </div>
  );
}
