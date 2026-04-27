import { createFileRoute } from "@tanstack/react-router";
import { AiChatScreen } from "../../components/chat/ai-chat-screen";

export const Route = createFileRoute("/_auth/companion")({
  component: () => <AiChatScreen variant="companion" />,
});
