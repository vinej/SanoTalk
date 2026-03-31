import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/setup-2fa")({
  beforeLoad: async () => {
    // Must be logged in to reach this page
    const session = await authClient.getSession();
    if (!session.data?.user) throw redirect({ to: "/login" });
    // Already set up — go to dashboard (guard will handle 2FA check)
    const user = session.data.user as any;
    if (user.twoFactorEnabled) throw redirect({ to: "/dashboard" });
  },
  component: SetupTwoFactorPage,
});

function SetupTwoFactorPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const { error } = await (authClient as any).twoFactor.enable({ password });
    if (error) {
      setError(error.message ?? "Could not enable 2FA. Check your password.");
      setIsPending(false);
      return;
    }

    // 2FA is now enabled — redirect to /two-factor for first OTP verification
    navigate({ to: "/two-factor" as any });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <div className="w-full max-w-sm px-4">
        <div className="bg-card border rounded-xl p-6 shadow-sm space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Set up two-factor authentication</h1>
            <p className="text-sm text-muted-foreground">
              SanoTalk requires 2FA for all accounts. A one-time code will be sent
              to your email each time you sign in.
            </p>
          </div>

          <form onSubmit={handleEnable} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Confirm your password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Enabling…" : "Enable 2FA and continue"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
