import { createFileRoute } from "@tanstack/react-router";
import { AiChatPanel } from "../../components/chat/ai-chat-panel";

export const Route = createFileRoute("/_auth/test-ai")({
  component: TestAiPage,
});

function TestAiPage() {
  return (
    <div className="flex-1 min-h-0 p-4">
      <AiChatPanel variant="test" />
    </div>
  );
}
