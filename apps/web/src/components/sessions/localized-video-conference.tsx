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
  Toast,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { Track } from "livekit-client";
import { useTranslation } from "react-i18next";

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
    <div className="lk-control-bar">
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

function VideoConferenceInner() {
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

export function LocalizedVideoConference() {
  const layoutContext = useCreateLayoutContext();
  const [widgetState, setWidgetState] = useState<{ showChat: boolean; unreadMessages: number; showSettings?: boolean }>({ showChat: false, unreadMessages: 0 });

  return (
    <div className="lk-video-conference">
      <LayoutContextProvider value={layoutContext} onWidgetChange={setWidgetState}>
        <VideoConferenceInner />
        <Chat style={{ display: widgetState.showChat ? "grid" : "none" }} />
      </LayoutContextProvider>
      <AutoHideConnectionToast />
    </div>
  );
}
