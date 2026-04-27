import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { AiChatPanel } from "./ai-chat-panel";
import { AiTransparencyNotice } from "../ai-transparency-notice";

type ChatVariant = "health" | "companion" | "news" | "pharmacist" | "drugInfo" | "test" | "exercise" | "eatwell" | "general_ai";

interface Props {
  variant?: ChatVariant;
  showTransparencyNotice?: boolean;
  /** Optional content rendered between the back link and the transparency notice. */
  children?: ReactNode;
}

/**
 * Shared scaffold for every `/_auth/*` AI assistant route: back link, optional
 * transparency notice, and the chat panel. Keeps the 9 per-variant route files
 * to a few lines each.
 */
export function AiChatScreen({ variant, showTransparencyNotice = true, children }: Props) {
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
      {children}
      {showTransparencyNotice && <AiTransparencyNotice />}
      <AiChatPanel {...(variant ? { variant } : {})} />
    </div>
  );
}
