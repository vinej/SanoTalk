import { useCallback, useState } from "react";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { LocalizedVideoConference } from "./localized-video-conference";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { useTranscriptSocket } from "../../hooks/use-transcript-socket";
import { TalkSession } from "@sanotalk/db";
import { useTranslation } from "react-i18next";
import { X, UserPlus } from "lucide-react";

type Props = {
  session: TalkSession;
  onFinalTranscript?: (text: string) => void;
}

export function LiveSessionRoom({ session, onFinalTranscript }: Props) {
  const { t } = useTranslation("sessions");
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: profile } = trpc.user.profile.useQuery();
  const isHost = profile?.id === session.hostId;

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

  const handleDisconnected = useCallback(() => {
    setToken(null);
    setServerUrl(null);
  }, []);

  if (!token || !serverUrl) {
    return (
      <div className="overflow-y-auto h-full">
        <div className="flex flex-col items-center justify-center min-h-full gap-6 p-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold">{session.title ?? session.roomName}</h2>
            <p className="text-muted-foreground">{t("room.room")}: {session.roomName}</p>
          </div>
          {isHost && session.status !== "completed" && session.status !== "cancelled" && (
            <ParticipantsPanel sessionId={session.id} session={session} onUpdate={() => utils.sessions.byId.invalidate({ id: session.id })} />
          )}
          <Button
            size="lg"
            onClick={handleJoin}
            disabled={getTokenMutation.isPending}
          >
            {getTokenMutation.isPending ? t("room.connecting") : t("room.join")}
          </Button>
        </div>
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
      data-lk-theme="huddle"
      style={{ height: "100%", width: "100%" }}
      onDisconnected={handleDisconnected}
    >
      <LocalizedVideoConference participants={(session as any).participants ?? []} />
      <RoomAudioRenderer />
      <TranscriptionOverlay sessionId={session.id} language={session.language} {...(onFinalTranscript ? { onFinalTranscript } : {})} />
    </LiveKitRoom>
  );
}

function ParticipantsPanel({ sessionId, session, onUpdate }: { sessionId: string; session: TalkSession; onUpdate: () => void }) {
  const { t } = useTranslation("sessions");
  const [selectedUserId, setSelectedUserId] = useState("");

  const participants: Array<{ id: string; userId: string; user?: { id: string; name: string | null } }> =
    (session as any).participants ?? [];

  const { data: allUsers = [] } = trpc.user.listAll.useQuery();

  const addedUserIds = new Set(participants.map((p) => p.userId));
  const availableUsers = allUsers.filter(
    (u) => u.id !== session.hostId && !addedUserIds.has(u.id)
  );

  const addMutation = trpc.sessions.addParticipant.useMutation({
    onSuccess: () => {
      setSelectedUserId("");
      onUpdate();
    },
  });

  const removeMutation = trpc.sessions.removeParticipant.useMutation({
    onSuccess: onUpdate,
  });

  return (
    <div className="w-full max-w-sm space-y-3">
      <p className="text-sm font-medium">{t("participants.title")}</p>

      <div className="flex gap-2">
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">{t("participants.selectUser")}</option>
          {availableUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.name ?? u.id}</option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => addMutation.mutate({ sessionId, userId: selectedUserId })}
          disabled={!selectedUserId || addMutation.isPending}
        >
          <UserPlus className="h-4 w-4" />
          {t("participants.add")}
        </Button>
      </div>

      {participants.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("participants.empty")}</p>
      ) : (
        <ul className="space-y-1">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-sm bg-muted rounded px-2 py-1">
              <span>{p.user?.name ?? p.userId}</span>
              <button
                onClick={() => removeMutation.mutate({ sessionId, userId: p.userId })}
                className="text-muted-foreground hover:text-destructive ml-2"
                aria-label={t("participants.remove")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TranscriptionOverlay({ sessionId, language, onFinalTranscript }: { sessionId: string; language: string; onFinalTranscript?: (text: string) => void }) {
  const { liveText, isRecording, micError } = useTranscriptSocket(sessionId, { language, ...(onFinalTranscript ? { onFinalTranscript } : {}) });
  const { t } = useTranslation("sessions");

  return (
    <>
      <div className="absolute bottom-16 right-4 flex items-center gap-2 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs backdrop-blur-sm">
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
