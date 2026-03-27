import { createFileRoute } from "@tanstack/react-router";
import { AiChatPanel } from "../../components/chat/ai-chat-panel";

export const Route = createFileRoute("/_auth/ai-assistant")({
  component: AiAssistantPage,
});

function AiAssistantPage() {
  return (
    <div className="flex-1 min-h-0 p-4">
      <AiChatPanel />
    </div>
  );
}
