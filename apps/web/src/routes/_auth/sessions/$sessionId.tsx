import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { trpc } from "../../../lib/trpc";
import { LiveSessionRoom } from "../../../components/sessions/live-session-room";
import { TranscriptPanel } from "../../../components/transcript/transcript-panel";
import { SummaryPanel } from "../../../components/summary/summary-panel";
import { AiChatPanel } from "../../../components/chat/ai-chat-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { useTranslation } from "react-i18next";


export const Route = createFileRoute("/_auth/sessions/$sessionId")({
  component: SessionPage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) ?? "transcript",
  }),
});

function SessionPage() {
  const { sessionId } = Route.useParams();
  const { tab } = Route.useSearch();
  const { t } = useTranslation(["sessions", "common"]);
  const { data: session, isLoading } = trpc.sessions.byId.useQuery({ id: sessionId });
  const [pendingVoiceText, setPendingVoiceText] = useState<string | undefined>();
  const handleFinalTranscript = useCallback((text: string) => {
    setPendingVoiceText(text);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="animate-pulse text-muted-foreground">
          {t("detail.loading")}
        </div>
      </div>
    );
  }

  if (!session) return null

  const sessionWithDates = {
      ...session,
      id: session.id,
      hostId: session.hostId,
      roomName: session.roomName,
      status: session.status,
      scheduledAt: session.scheduledAt ? new Date(session.scheduledAt) : null,
      startedAt: session.startedAt ? new Date(session.startedAt) : null,
      endedAt: session.endedAt ? new Date(session.endedAt) : null,
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-1 h-full gap-0">
          {/* Live Room — occupies 1/2 on desktop */}
          <div className="border-r h-full overflow-hidden">
            <LiveSessionRoom session={sessionWithDates} onFinalTranscript={handleFinalTranscript} />
          </div>

          {/* Side panel */}
          <div className="flex flex-col h-full overflow-hidden">
            <Tabs defaultValue={tab} className="flex flex-col h-full">
              <TabsList className="m-2 shrink-0">
                <TabsTrigger value="transcript">{t("sessions:detail.transcript")}</TabsTrigger>
                <TabsTrigger value="summary">{t("sessions:detail.aiSummary")}</TabsTrigger>
                <TabsTrigger value="chat">{t("sessions:detail.aiAssistant")}</TabsTrigger>
              </TabsList>
              <TabsContent
                value="transcript"
                className="flex-1 min-h-0 overflow-hidden m-0 p-2"
              >
                <TranscriptPanel sessionId={sessionId} />
              </TabsContent>
              <TabsContent
                value="summary"
                className="flex-1 min-h-0 overflow-hidden m-0 p-2"
              >
                <SummaryPanel sessionId={sessionId} />
              </TabsContent>
              <TabsContent
                value="chat"
                className="flex-1 min-h-0 overflow-hidden m-0 p-2"
              >
                <AiChatPanel sessionId={sessionId} {...(pendingVoiceText ? { pendingVoiceText } : {})} onVoiceTextConsumed={() => setPendingVoiceText(undefined)} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
