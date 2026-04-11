import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import { Clock } from "lucide-react";
import { LanguageSwitcher } from "../components/language-switcher";
import { authClient } from "../lib/auth-client";

export const Route: any = createFileRoute("/pending-approval")({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: "/login" });
    }
  },
  component: PendingApprovalPage,
});

function PendingApprovalPage() {
  const { t } = useTranslation("common");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="text-center space-y-4 max-w-md px-4">
        <Clock className="h-12 w-12 text-amber-500 mx-auto" />
        <h1 className="text-2xl font-bold">{t("pendingApproval.title")}</h1>
        <p className="text-muted-foreground">{t("pendingApproval.message")}</p>
        <Link to="/login">
          <Button variant="outline" className="mt-4">{t("pendingApproval.backToLogin")}</Button>
        </Link>
      </div>
    </div>
  );
}
