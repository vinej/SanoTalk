import { createFileRoute } from "@tanstack/react-router";
import { AiChatPanel } from "../../components/chat/ai-chat-panel";
import { AiTransparencyNotice } from "../../components/ai-transparency-notice";

export const Route = createFileRoute("/_auth/drug-info")({
  component: DrugInfoPage,
});

function DrugInfoPage() {
  return (
    <div className="flex-1 min-h-0 p-4 flex flex-col gap-2">
      <AiTransparencyNotice />
      <AiChatPanel variant="drugInfo" />
    </div>
  );
}
