import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { AiChatPanel } from "../../components/chat/ai-chat-panel";
import { AiTransparencyNotice } from "../../components/ai-transparency-notice";

export const Route = createFileRoute("/_auth/pharmacist")({
  component: PharmacistPage,
});

function PharmacistPage() {
  const { t } = useTranslation("common");
  return (
    <div className="flex-1 min-h-0 p-4 flex flex-col gap-2">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToDashboard")}
      </Link>
      <AiTransparencyNotice />
      <AiChatPanel variant="pharmacist" />
    </div>
  );
}
