import { createFileRoute, redirect } from "@tanstack/react-router";
import { AiChatPanel } from "../../components/chat/ai-chat-panel";

export const Route = createFileRoute("/_auth/test-ai")({
  beforeLoad: async ({ context }: { context: { user?: { role?: string } } }) => {
    if ((context.user as any)?.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: TestAiPage,
});

function TestAiPage() {
  return (
    <div className="flex-1 min-h-0 p-4">
      <AiChatPanel variant="test" />
    </div>
  );
}
