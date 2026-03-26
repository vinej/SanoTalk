import { createFileRoute, Link } from "@tanstack/react-router";
import { AiChatPanel } from "../../components/chat/ai-chat-panel";
import { ArrowLeft, Heart } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/companion")({
  component: CompanionPage,
});

function CompanionPage() {
  const { t } = useTranslation(["dashboard", "common"]);

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <Button size="sm" variant="ghost" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t("common:back")}
          </Link>
        </Button>
        <Heart className="w-4 h-4 text-rose-500" />
        <span className="font-medium">{t("dashboard:companion")}</span>
      </div>
      <div className="flex-1 min-h-0 p-4">
        <AiChatPanel variant="companion" />
      </div>
    </div>
  );
}
