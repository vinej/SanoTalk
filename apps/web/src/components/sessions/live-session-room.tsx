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
import { useSession } from "../../lib/auth-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";

type Props = {
  session: TalkSession;
  onFinalTranscript?: (text: string) => void;
}

export function LiveSessionRoom({ session, onFinalTranscript }: Props) {
  const { t } = useTranslation("sessions");
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [showUnaddedDialog, setShowUnaddedDialog] = useState(false);
  const utils = trpc.useUtils();

  const { data: profile } = trpc.user.profile.useQuery();
  const { data: linkedUsers = [] } = trpc.user.listLinkedUsers.useQuery();
  const { data: friends = [] } = trpc.user.listFriends.useQuery();
  const isHost = profile?.id === session.hostId;
  const hostRole = (profile as any)?.role as string | undefined;

  const allCandidates = [...linkedUsers, ...friends].filter(
    (u, i, arr) => u && arr.findIndex((x) => x?.id === u.id) === i
  );
  const selectedUserName = allCandidates.find((u) => u?.id === selectedUserId)?.name ?? selectedUserId;

  const getTokenMutation = trpc.livekit.getToken.useMutation({
    onSuccess(data) {
      setToken(data.token);
      setServerUrl(data.serverUrl);
    },
  });

  const startMutation = trpc.sessions.start.useMutation();

  const addForJoinMutation = trpc.sessions.addParticipant.useMutation({
    onSuccess: () => {
      setSelectedUserId("");
      setShowUnaddedDialog(false);
      void utils.sessions.byId.invalidate({ id: session.id });
      void performJoin();
    },
  });

  const performJoin = useCallback(async () => {
    if (isHost) {
      await startMutation.mutateAsync({ id: session.id });
    }
    getTokenMutation.mutate({ roomName: session.roomName });
  }, [session, isHost, getTokenMutation, startMutation]);

  const handleJoin = useCallback(async () => {
    if (selectedUserId) {
      setShowUnaddedDialog(true);
      return;
    }
    await performJoin();
  }, [selectedUserId, performJoin]);

  const handleDisconnected = useCallback(() => {
    setToken(null);
    setServerUrl(null);
  }, []);

  if (!token || !serverUrl) {
    return (
      <>
        <div className="overflow-y-auto h-full">
          <div className="flex flex-col items-center justify-center min-h-full gap-6 p-8">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">{session.title ?? session.roomName}</h2>
              <p className="text-muted-foreground">{t("room.room")}: {session.roomName}</p>
            </div>
            {isHost && session.status !== "completed" && session.status !== "cancelled" && (
              <ParticipantsPanel
                sessionId={session.id}
                session={session}
                linkedUsers={linkedUsers}
                friends={friends}
                hostRole={hostRole}
                selectedUserId={selectedUserId}
                onSelectedUserChange={setSelectedUserId}
                onUpdate={() => utils.sessions.byId.invalidate({ id: session.id })}
              />
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

        <Dialog open={showUnaddedDialog} onOpenChange={setShowUnaddedDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("participants.unaddedTitle")}</DialogTitle>
              <DialogDescription>
                {t("participants.unaddedDesc", { name: selectedUserName })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowUnaddedDialog(false)}>
                {t("chat.clearDialog.cancel")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedUserId("");
                  setShowUnaddedDialog(false);
                  void performJoin();
                }}
              >
                {t("participants.joinWithout")}
              </Button>
              <Button
                size="sm"
                disabled={addForJoinMutation.isPending}
                onClick={() => addForJoinMutation.mutate({ sessionId: session.id, userId: selectedUserId })}
              >
                {t("participants.addAndJoin")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={false}
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

function ParticipantsPanel({
  sessionId,
  session,
  linkedUsers,
  friends,
  hostRole,
  selectedUserId,
  onSelectedUserChange,
  onUpdate,
}: {
  sessionId: string;
  session: TalkSession;
  linkedUsers: Array<{ id?: string; name?: string | null } | null>;
  friends: Array<{ id?: string; name?: string | null } | null>;
  hostRole: string | undefined;
  selectedUserId: string;
  onSelectedUserChange: (id: string) => void;
  onUpdate: () => void;
}) {
  const { t } = useTranslation("sessions");
  const { data: aiAssistants = [] } = trpc.user.listAiAssistants.useQuery();

  const participants: Array<{ id: string; userId: string; user?: { id: string; name: string | null } }> =
    (session as any).participants ?? [];

  const addedUserIds = new Set(participants.map((p) => p.userId));
  const aiAssistantIds = new Set(aiAssistants.map((a) => a.id));

  const linkedIds = new Set(linkedUsers.map((u) => u?.id).filter(Boolean));
  const friendIds = new Set(friends.map((u) => u?.id).filter(Boolean));

  // For doctor/pharmacist: block mixing patients and friends as participants
  // AI assistants are excluded from this restriction
  const isProfessional = hostRole === "doctor" || hostRole === "pharmacist";
  const hasPatientParticipant = isProfessional && participants.some((p) => linkedIds.has(p.userId));
  const hasFriendParticipant  = isProfessional && participants.some((p) => friendIds.has(p.userId) && !aiAssistantIds.has(p.userId));

  const candidateUsers = [...linkedUsers, ...friends].filter(
    (u, i, arr) => u && arr.findIndex((x) => x?.id === u.id) === i
  );

  const availableUsers = candidateUsers.filter((u) => {
    if (!u?.id || u.id === session.hostId || addedUserIds.has(u.id)) return false;
    if (isProfessional) {
      if (hasPatientParticipant && friendIds.has(u.id)) return false;
      if (hasFriendParticipant  && linkedIds.has(u.id)) return false;
    }
    return true;
  });

  const availableAiAssistants = aiAssistants.filter((a) => !addedUserIds.has(a.id));

  const AI_TYPE_LABELS: Record<string, string> = {
    wellness: t("participants.aiType.wellness"),
    health_specialist: t("participants.aiType.health_specialist"),
    friend: t("participants.aiType.friend"),
  };

  const addMutation = trpc.sessions.addParticipant.useMutation({
    onSuccess: () => {
      onSelectedUserChange("");
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
          onChange={(e) => onSelectedUserChange(e.target.value)}
          className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">{t("participants.selectUser")}</option>
          {availableUsers.map((u) => (
            <option key={u?.id} value={u?.id}>{u?.name ?? u?.id}</option>
          ))}
          {availableAiAssistants.length > 0 && (
            <optgroup label={t("participants.aiAssistants")}>
              {availableAiAssistants.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {AI_TYPE_LABELS[a.type] ?? a.type}
                </option>
              ))}
            </optgroup>
          )}
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
          {participants.map((p) => {
            const isAi = aiAssistantIds.has(p.userId);
            return (
              <li key={p.id} className="flex items-center justify-between text-sm bg-muted rounded px-2 py-1">
                <span className="flex items-center gap-1.5">
                  {p.user?.name ?? p.userId}
                  {isAi && (
                    <span className="text-[10px] font-medium bg-primary/15 text-primary rounded px-1 py-0.5 leading-none">
                      {t("participants.aiBadge")}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => removeMutation.mutate({ sessionId, userId: p.userId })}
                  className="text-muted-foreground hover:text-destructive ml-2"
                  aria-label={t("participants.remove")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TranscriptionOverlay({ sessionId, language, onFinalTranscript }: { sessionId: string; language: string; onFinalTranscript?: (text: string) => void }) {
  const { data: sessionData } = useSession();
  const isAuthenticated = !!sessionData?.session?.token;
  const { liveText, isRecording, micError } = useTranscriptSocket(sessionId, { enabled: isAuthenticated, language, ...(onFinalTranscript ? { onFinalTranscript } : {}) });
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
