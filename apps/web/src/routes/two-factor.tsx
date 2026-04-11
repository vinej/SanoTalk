import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { authClient } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export const Route = createFileRoute("/two-factor")({
  component: TwoFactorPage,
});

function TwoFactorPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isSending, setIsSending] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSentOtp = useRef(false);

  async function sendOtp() {
    setIsSending(true);
    setError(null);
    const { error } = await (authClient as any).twoFactor.sendOtp();
    if (error) {
      // No pending 2FA session — send back to login
      navigate({ to: "/login" as any });
    } else {
      setIsSending(false);
      setResendCooldown(60);
      inputRef.current?.focus();
    }
  }

  useEffect(() => {
    // Guard against React StrictMode running the effect twice in development,
    // which would send two OTP emails on a single page mount.
    if (hasSentOtp.current) return;
    hasSentOtp.current = true;
    void sendOtp();
  }, []);

  // Countdown for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    const { error } = await (authClient as any).twoFactor.verifyOtp({ code });
    if (error) {
      setError("Invalid code. Please try again.");
      setIsPending(false);
    } else {
      const raw = sessionStorage.getItem("postLoginRedirect") ?? "/dashboard";
      sessionStorage.removeItem("postLoginRedirect");
      // Validate redirect is a safe relative path to prevent open redirect
      const SAFE_PATH_RE = /^\/[a-zA-Z0-9\-_/]*$/;
      const rawPath = raw.split("?")[0] ?? "";
      const safe = raw.startsWith("/") && !raw.startsWith("//") && !rawPath.includes("..") && SAFE_PATH_RE.test(rawPath) ? raw : "/dashboard";
      const [path, qs] = safe.split("?");
      const search = qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined;
      navigate({ to: path as any, search: search as any });
    }
  }

  if (isSending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Sending verification code…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <div className="w-full max-w-sm px-4">
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Verify your identity</h1>
            <p className="text-sm text-muted-foreground">
              A verification code was sent to your email. Enter it below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isPending || code.length < 6}>
              {isPending ? "Verifying…" : "Verify"}
            </Button>
          </form>

          <Button
            variant="ghost"
            className="w-full text-sm"
            disabled={resendCooldown > 0}
            onClick={sendOtp}
          >
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
          </Button>
        </div>
      </div>
    </div>
  );
}
