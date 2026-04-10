import { createFileRoute } from "@tanstack/react-router";
import { AiChatPanel } from "../../components/chat/ai-chat-panel";

export const Route = createFileRoute("/_auth/drug-info")({
  component: DrugInfoPage,
});

function DrugInfoPage() {
  return (
    <div className="flex-1 min-h-0 p-4">
      <AiChatPanel variant="drugInfo" />
    </div>
  );
}
