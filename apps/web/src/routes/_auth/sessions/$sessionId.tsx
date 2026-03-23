import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../lib/trpc";
import { LiveSessionRoom } from "../../../components/sessions/live-session-room";
import { TranscriptPanel } from "../../../components/transcript/transcript-panel";
import { SummaryPanel } from "../../../components/summary/summary-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { appRouter } from "node_modules/@sanotalk/trpc/src/router";
import { id } from "zod/v4/locales";

export const Route = createFileRoute("/_auth/sessions/$sessionId")({
  component: SessionPage,
});


function SessionPage() {
  const { sessionId } = Route.useParams();
  const { data: session, isLoading } = trpc.sessions.byId.useQuery({ id: sessionId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-muted-foreground">
          Loading session…
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
    <div className="flex flex-col h-screen">
      <div className="flex-1 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 h-full gap-0">
          {/* Live Room — occupies 2/3 on desktop */}
          <div className="lg:col-span-2 border-r">
            <LiveSessionRoom session ={ sessionWithDates } />
          </div>

          {/* Side panel */}
          <div className="flex flex-col h-full overflow-hidden">
            <Tabs defaultValue="transcript" className="flex flex-col h-full">
              <TabsList className="m-2 shrink-0">
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="summary">AI Summary</TabsTrigger>
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
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
