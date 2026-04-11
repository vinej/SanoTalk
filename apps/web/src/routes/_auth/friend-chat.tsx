import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { FriendChatRoomList } from "../../components/chat/friend-chat-room-list";
import { FriendChatPanel } from "../../components/chat/friend-chat-panel";

export const Route = createFileRoute("/_auth/friend-chat")({
  component: FriendChatPage,
});

function FriendChatPage() {
  const { t } = useTranslation("chat");
  const { data: profile } = trpc.user.profile.useQuery();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const currentUserId = profile?.id ?? "";

  return (
    <div className="flex flex-col h-[calc(100vh-65px)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
        {selectedRoomId ? (
          <button
            onClick={() => setSelectedRoomId(null)}
            className="lg:hidden flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <Link
            to="/dashboard"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}
        <MessageCircle className="h-5 w-5 text-pink-600" />
        <h1 className="text-lg font-semibold">{t("title")}</h1>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Room list — hidden on mobile when a room is selected */}
        <div className={`w-full lg:w-72 lg:shrink-0 ${selectedRoomId ? "hidden lg:flex lg:flex-col" : "flex flex-col"}`}>
          <FriendChatRoomList
            currentUserId={currentUserId}
            selectedRoomId={selectedRoomId}
            onSelectRoom={setSelectedRoomId}
          />
        </div>

        {/* Chat panel */}
        <div className={`flex-1 flex flex-col min-w-0 ${!selectedRoomId ? "hidden lg:flex" : "flex"}`}>
          {selectedRoomId && currentUserId ? (
            <FriendChatPanel
              key={selectedRoomId}
              roomId={selectedRoomId}
              currentUserId={currentUserId}
              onLeft={() => setSelectedRoomId(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm">{t("noRoomsHint")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
