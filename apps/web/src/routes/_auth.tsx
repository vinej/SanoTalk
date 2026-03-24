import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";

export const Route: any = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: "/login" });
    }
    const user = session.data.user as any;
    // If 2FA has never been set up, send to the setup page first
    if (!user.twoFactorEnabled) {
      throw redirect({ to: "/setup-2fa" });
    }
    return { user: session.data.user };
  },
  component: () => <Outlet />,
});
