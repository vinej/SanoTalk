import { useState, useEffect } from "react";
import {
  GridLayout,
  ParticipantTile,
  useTracks,
  TrackToggle,
  ChatToggle,
  DisconnectButton,
  Chat,
  LayoutContextProvider,
  FocusLayoutContainer,
  FocusLayout,
  CarouselLayout,
  useCreateLayoutContext,
  MediaDeviceMenu,
  usePinnedTracks,
  useTrackToggle,
  useConnectionState,
  useParticipants,
  useLocalParticipant,
  Toast,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { Track } from "livekit-client";
import { useTranslation } from "react-i18next";

type SessionParticipant = { userId: string; user?: { name: string | null; role?: string | null } | null };

function AutoHideConnectionToast() {
  const state = useConnectionState();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (state === ConnectionState.Reconnecting) {
      setVisible(true);
      return;
    }
    if (state === ConnectionState.Disconnected) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
    setVisible(false);
  }, [state]);

  if (!visible) return null;

  return (
    <Toast className="lk-toast-connection-state">
      {state === ConnectionState.Reconnecting && "Reconnecting…"}
      {state === ConnectionState.Disconnected && "Disconnected"}
    </Toast>
  );
}

function LocalizedControlBar() {
  const { t } = useTranslation("sessions");
  const { enabled: screenShareEnabled } = useTrackToggle({ source: Track.Source.ScreenShare });

  return (
    <div className="lk-control-bar" style={{ gap: "4px", padding: "0 4px" }}>
      <div className="lk-button-group">
        <TrackToggle source={Track.Source.Microphone}>
          {t("room.controls.microphone")}
        </TrackToggle>
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="audioinput" />
        </div>
      </div>
      <div className="lk-button-group">
        <TrackToggle source={Track.Source.Camera}>
          {t("room.controls.camera")}
        </TrackToggle>
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="videoinput" />
        </div>
      </div>
      <TrackToggle source={Track.Source.ScreenShare}>
        {screenShareEnabled ? t("room.controls.screenShareStop") : t("room.controls.screenShare")}
      </TrackToggle>
      <ChatToggle>{t("room.controls.chat")}</ChatToggle>
      <DisconnectButton>{t("room.controls.leave")}</DisconnectButton>
    </div>
  );
}

function ParticipantsStatusPanel({ participants }: { participants: SessionParticipant[] }) {
  const { t } = useTranslation("sessions");
  const remoteParticipants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const connectedIds = new Set([
    localParticipant.identity,
    ...remoteParticipants.map((p) => p.identity),
  ]);

  if (participants.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-2 py-1.5 bg-black/40 backdrop-blur-sm">
      {participants.map((p) => {
        const connected = connectedIds.has(p.userId);
        const isAi = p.user?.role === "ia_agent";
        return (
          <span
            key={p.userId}
            className="flex items-center gap-1 text-xs text-white/90 bg-white/10 rounded-full px-2 py-0.5"
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? "bg-green-400" : "bg-white/30"}`} />
            {p.user?.name ?? p.userId}
            {isAi && (
              <span className="text-[9px] font-medium bg-white/20 rounded px-1 py-px leading-none">
                {t("participants.aiBadge")}
              </span>
            )}
            <span className="text-white/50">{connected ? t("participants.connected") : t("participants.notConnected")}</span>
          </span>
        );
      })}
    </div>
  );
}

function VideoConferenceInner({ participants }: { participants: SessionParticipant[] }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const focusedTracks = usePinnedTracks();
  const carouselTracks = tracks.filter((t) => !focusedTracks.includes(t));

  return (
    <div className="lk-video-conference-inner">
      <ParticipantsStatusPanel participants={participants} />
      {focusedTracks.length > 0 ? (
        <FocusLayoutContainer>
          <CarouselLayout tracks={carouselTracks}>
            <ParticipantTile />
          </CarouselLayout>
          {focusedTracks[0] && <FocusLayout trackRef={focusedTracks[0]} />}
        </FocusLayoutContainer>
      ) : (
        <GridLayout tracks={tracks}>
          <ParticipantTile />
        </GridLayout>
      )}
      <LocalizedControlBar />
    </div>
  );
}

export function LocalizedVideoConference({ participants = [] }: { participants?: SessionParticipant[] }) {
  const layoutContext = useCreateLayoutContext();
  const [widgetState, setWidgetState] = useState<{ showChat: boolean; unreadMessages: number; showSettings?: boolean }>({ showChat: false, unreadMessages: 0 });

  return (
    <div className="lk-video-conference">
      <LayoutContextProvider value={layoutContext} onWidgetChange={setWidgetState}>
        <VideoConferenceInner participants={participants} />
        <Chat style={{ display: widgetState.showChat ? "grid" : "none" }} />
      </LayoutContextProvider>
      <AutoHideConnectionToast />
    </div>
  );
}
