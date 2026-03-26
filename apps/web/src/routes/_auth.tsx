import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";
import { tracker } from "../lib/tracker";

export const Route: any = createFileRoute("/_auth")({
  beforeLoad: async ({ location }) => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      const intended = location.pathname + (location.searchStr ?? "");
      if (intended && intended !== "/") {
        sessionStorage.setItem("postLoginRedirect", intended);
      }
      throw redirect({ to: "/login" });
    }
    const user = session.data.user as any;
    if (tracker) {
      tracker.setUserID(user.email);
      console.log("[OpenReplay] setUserID:", user.email);
    }
    // If 2FA has never been set up, send to the setup page first
    if (!user.twoFactorEnabled) {
      throw redirect({ to: "/setup-2fa" });
    }
    return { user: session.data.user };
  },
  component: () => <Outlet />,
});
