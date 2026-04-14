import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";
import { tracker } from "../lib/tracker";
import { hasAnalyticsConsent } from "../components/cookie-consent-banner";
import { AppHeader } from "../components/app-header";
import { PrivacyFooter } from "../components/privacy-footer";
import { useHeartbeat } from "../hooks/use-heartbeat";
import { useIdleTimeout } from "../hooks/use-idle-timeout";

export const Route: any = createFileRoute("/_auth")({
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      const intended = location.pathname;
      if (intended && intended !== "/") {
        sessionStorage.setItem("postLoginRedirect", intended);
      }
      throw redirect({ to: "/login" });
    }
    const user = session.data.user as any;
    if (tracker && hasAnalyticsConsent()) {
      void tracker.start().catch(() => {});
      // Use a hashed ID to avoid sending the raw database user ID to OpenReplay
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(user.id));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      tracker.setUserID(hashHex.slice(0, 16));
    }
    // If 2FA has never been set up, send to the setup page first
    if (!user.twoFactorEnabled) {
      throw redirect({ to: "/setup-2fa" });
    }
    // If account not yet approved by admin, show pending page
    if (!user.approved) {
      throw redirect({ to: "/pending-approval" });
    }
    return { user: session.data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  useHeartbeat();
  useIdleTimeout();
  return (
    <div className="h-screen flex flex-col">
      <AppHeader />
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        <Outlet />
        <PrivacyFooter />
      </div>
    </div>
  );
}
