import { useCallback, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { useTranscriptSocket } from "../../hooks/use-transcript-socket";
import { TalkSession } from "@sanotalk/db";
import { useTranslation } from "react-i18next";

type Props = {
  session: TalkSession;
  onFinalTranscript?: (text: string) => void;
}

export function LiveSessionRoom({ session, onFinalTranscript }: Props) {
  const { t } = useTranslation("sessions");
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
          <p className="text-muted-foreground">{t("room.room")}: {session.roomName}</p>
        </div>
        <Button
          size="lg"
          onClick={handleJoin}
          disabled={getTokenMutation.isPending}
        >
          {getTokenMutation.isPending ? t("room.connecting") : t("room.join")}
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
      <TranscriptionOverlay sessionId={session.id} {...(onFinalTranscript ? { onFinalTranscript } : {})} />
    </LiveKitRoom>
  );
}

function TranscriptionOverlay({ sessionId, onFinalTranscript }: { sessionId: string; onFinalTranscript?: (text: string) => void }) {
  const { liveText, isRecording, micError } = useTranscriptSocket(sessionId, onFinalTranscript ? { onFinalTranscript } : {});
  const { t } = useTranslation("sessions");

  return (
    <>
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs backdrop-blur-sm">
        {isRecording && <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
        {!isRecording && micError && <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />}
        {!isRecording && !micError && <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />}
        {micError ? t("room.micError", { error: micError }) : isRecording ? t("room.recording") : t("room.connectingMic")}
      </div>
      {liveText && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg max-w-xl text-center text-sm backdrop-blur-sm">
          {liveText}
        </div>
      )}
    </>
  );
}
