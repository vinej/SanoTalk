import { useMemo } from "react";
import { ParticipantTile, useMaybeTrackRefContext, useIsMuted } from "@livekit/components-react";

type AvatarParticipantTileProps = React.ComponentProps<typeof ParticipantTile>;

/**
 * Wraps the standard ParticipantTile and overlays the participant's
 * profile photo when the camera is off.
 *
 * The avatar URL is read from participant.metadata (JSON: { avatarUrl: string }).
 */
export function AvatarParticipantTile(props: AvatarParticipantTileProps) {
  const contextTrackRef = useMaybeTrackRefContext();
  const trackRef = props.trackRef ?? contextTrackRef;

  const participant = trackRef?.participant;
  const isMuted = useIsMuted(trackRef!);
  const isCameraOff = !trackRef?.publication || isMuted;

  const avatarUrl = useMemo(() => {
    if (!participant?.metadata) return null;
    try {
      const meta = JSON.parse(participant.metadata) as { avatarUrl?: string | null };
      const url = meta.avatarUrl;
      if (url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/"))) return url;
      return null;
    } catch {
      return null;
    }
  }, [participant?.metadata]);

  const showAvatar = isCameraOff && !!avatarUrl;

  return (
    <div className="sanotalk-tile-wrapper">
      <ParticipantTile {...props} />
      {showAvatar && (
        <div className="sanotalk-avatar-overlay">
          <img
            src={avatarUrl!}
            alt={participant?.name ?? ""}
            className="sanotalk-avatar"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
    </div>
  );
}
