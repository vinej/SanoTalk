import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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

type AgentVariant = "health" | "companion" | "pharmacist";

function SessionPage() {
  const { sessionId } = Route.useParams();
  const { tab } = Route.useSearch();
  const { t } = useTranslation(["sessions", "common"]);
  const { data: session, isLoading } = trpc.sessions.byId.useQuery({ id: sessionId });
  const { data: aiAssistants = [] } = trpc.user.listAiAssistants.useQuery();
  const { data: linkedUsers = [] } = trpc.user.listLinkedUsers.useQuery();
  const [pendingVoiceText, setPendingVoiceText] = useState<string | undefined>();
  const [selectedAgent, setSelectedAgent] = useState<AgentVariant | null>(null);
  const setAgentTypeMutation = trpc.sessions.setAgentType.useMutation();
  const persistedAgentTypeRef = useRef(false);
  const handleFinalTranscript = useCallback((text: string) => {
    setPendingVoiceText(text);
  }, []);

  // Build a map of linked professional IDs → agentType for summary
  const linkedProfessionalMap = useMemo(() => {
    const map = new Map<string, AgentVariant>();
    for (const u of linkedUsers) {
      const role = (u as any)?.role as string | undefined;
      const linkType = (u as any)?.linkType as string | undefined;
      const id = (u as any)?.id as string | undefined;
      if (!id) continue;
      if (role === "pharmacist") {
        map.set(id, "pharmacist");
      } else if (role === "doctor" && linkType === "wellness") {
        map.set(id, "companion");
      } else if (role === "doctor") {
        map.set(id, "health");
      }
    }
    return map;
  }, [linkedUsers]);

  // Detect linked professional in session participants
  const participants: Array<{ userId: string; user?: { role?: string | null } }> = (session as any)?.participants ?? [];
  const aiAssistantIds = new Set(aiAssistants.map((a) => a.id));
  const nonAiParticipants = participants.filter((p) => !aiAssistantIds.has(p.userId));
  const isSoloSession = nonAiParticipants.length === 0;

  let professionalAgentType: AgentVariant | null = null;
  for (const p of nonAiParticipants) {
    const mapped = linkedProfessionalMap.get(p.userId);
    if (mapped) {
      professionalAgentType = mapped;
      break;
    }
  }
  const hasLinkedProfessional = professionalAgentType !== null;

  // Persist agentType on the session when a linked professional is detected
  useEffect(() => {
    if (hasLinkedProfessional && professionalAgentType && !persistedAgentTypeRef.current) {
      persistedAgentTypeRef.current = true;
      setAgentTypeMutation.mutate({ sessionId, agentType: professionalAgentType });
    }
  }, [hasLinkedProfessional, professionalAgentType, sessionId]);

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

  // Show AI Chat tab only for solo sessions after agent is selected
  const showSoloAiTabs = isSoloSession && selectedAgent !== null;
  // Show Summary tab for solo sessions with agent OR sessions with a linked professional
  const showSummaryTab = showSoloAiTabs || hasLinkedProfessional;
  // The effective agentType for the summary
  const effectiveAgentType: AgentVariant | undefined = showSoloAiTabs
    ? (selectedAgent ?? undefined)
    : professionalAgentType ?? undefined;

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

  // Agent label for the chat tab
  const agentTabLabel = selectedAgent === "companion"
    ? t("sessions:detail.aiCompanion")
    : selectedAgent === "pharmacist"
      ? t("sessions:detail.aiPharmacist")
      : t("sessions:detail.aiAssistant");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-1 h-full gap-0">
          {/* Live Room — occupies 1/2 on desktop */}
          <div className="border-r h-full overflow-hidden">
            <LiveSessionRoom
              session={sessionWithDates}
              onFinalTranscript={handleFinalTranscript}
              isSoloSession={isSoloSession}
              onAgentSelected={setSelectedAgent}
            />
          </div>

          {/* Side panel */}
          <div className="flex flex-col h-full overflow-hidden">
            <Tabs defaultValue={showSummaryTab ? tab : "transcript"} className="flex flex-col h-full">
              <TabsList className="m-2 shrink-0">
                <TabsTrigger value="transcript">{t("sessions:detail.transcript")}</TabsTrigger>
                {showSummaryTab && <TabsTrigger value="summary">{t("sessions:detail.aiSummary")}</TabsTrigger>}
                {showSoloAiTabs && <TabsTrigger value="chat">{agentTabLabel}</TabsTrigger>}
              </TabsList>
              <TabsContent
                value="transcript"
                className="flex-1 min-h-0 overflow-hidden m-0 p-2"
              >
                <TranscriptPanel sessionId={sessionId} />
              </TabsContent>
              {showSummaryTab && (
                <TabsContent
                  value="summary"
                  className="flex-1 min-h-0 overflow-hidden m-0 p-2"
                >
                  <SummaryPanel sessionId={sessionId} agentType={effectiveAgentType} />
                </TabsContent>
              )}
              {showSoloAiTabs && (
                <TabsContent
                  value="chat"
                  className="flex-1 min-h-0 overflow-hidden m-0 p-2"
                >
                  <AiChatPanel sessionId={sessionId} variant={selectedAgent!} {...(pendingVoiceText ? { pendingVoiceText } : {})} onVoiceTextConsumed={() => setPendingVoiceText(undefined)} />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
