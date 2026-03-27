import { createFileRoute } from "@tanstack/react-router";
import { AiChatPanel } from "../../components/chat/ai-chat-panel";

export const Route = createFileRoute("/_auth/companion")({
  component: CompanionPage,
});

function CompanionPage() {
  return (
    <div className="flex-1 min-h-0 p-4">
      <AiChatPanel variant="companion" />
    </div>
  );
}
