import { createFileRoute, redirect } from "@tanstack/react-router";
import { AiChatScreen } from "../../components/chat/ai-chat-screen";

export const Route = createFileRoute("/_auth/test-ai")({
  beforeLoad: async ({ context }: { context: { user?: { role?: string } } }) => {
    if (context.user?.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: () => <AiChatScreen variant="test" showTransparencyNotice={false} />,
});
