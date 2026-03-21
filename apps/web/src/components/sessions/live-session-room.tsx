import { useCallback, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useMaybeRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useTranscriptSocket } from "@/hooks/use-transcript-socket";
import { TalkSession } from "@sanotalk/db";

type Props = {
  session: TalkSession
}

export function LiveSessionRoom({ session }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  const getTokenMutation = trpc.livekit.getToken.useMutation({
    onSuccess(data) {
      setToken(data.token);
      setServerUrl(data.serverUrl);
    },
  });

  const startMutation = trpc.sessions.start.useMutation();

  const handleJoin = useCallback(async () => {
    await startMutation.mutateAsync({ id: session.id});
    getTokenMutation.mutate({ roomName: session.roomName });
  }, [session, getTokenMutation, startMutation]);

  if (!token || !serverUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">{session.hostId}</h2>
          <p className="text-muted-foreground">Room: {session.roomName}</p>
        </div>
        <Button
          size="lg"
          onClick={handleJoin}
          disabled={getTokenMutation.isPending}
        >
          {getTokenMutation.isPending ? "Connecting…" : "Join Session"}
        </Button>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={true}
      audio={true}
      data-lk-theme="default"
      style={{ height: "100%", width: "100%" }}
    >
      <VideoConference />
      <RoomAudioRenderer />
      <TranscriptionOverlay sessionId={session.id} />
    </LiveKitRoom>
  );
}

function TranscriptionOverlay({ sessionId }: { sessionId: string }) {
  const { liveText } = useTranscriptSocket(sessionId);

  if (!liveText) return null;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg max-w-xl text-center text-sm backdrop-blur-sm">
      {liveText}
    </div>
  );
}
