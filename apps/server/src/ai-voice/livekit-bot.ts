import {
  Room,
  RoomEvent,
  AudioSource,
  AudioFrame,
  AudioStream,
  LocalAudioTrack,
  TrackSource,
  type TrackPublishOptions,
} from "@livekit/rtc-node";
import { AccessToken } from "livekit-server-sdk";
import { logger } from "../logger.js";
import { SAMPLE_RATE } from "./tts-service.js";

const FRAME_DURATION_MS = 20; // 20ms frames
const SAMPLES_PER_FRAME = (SAMPLE_RATE / 1000) * FRAME_DURATION_MS; // 480 samples at 24kHz

export class LiveKitBot {
  private room: Room;
  private audioSource: AudioSource;
  private track: LocalAudioTrack | null = null;
  private connected = false;

  /** Callback fired when we receive audio frames from other participants */
  onAudioFrame?: (frame: AudioFrame, participantIdentity: string) => void;

  /** Callback fired when a chat message is received from the LiveKit room */
  onChatMessage?: (text: string, participantIdentity: string) => void;

  constructor() {
    this.room = new Room();
    this.audioSource = new AudioSource(SAMPLE_RATE, 1); // 24kHz mono
  }

  /**
   * Generate a server-side LiveKit token for the AI participant.
   */
  private async generateToken(
    roomName: string,
    identity: string,
    name: string,
    metadata?: string
  ): Promise<string> {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) throw new Error("LiveKit credentials not configured");

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name,
      ...(metadata ? { metadata } : {}),
      ttl: "1h",
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    return at.toJwt();
  }

  /**
   * Connect to a LiveKit room, publish an audio track, and start
   * listening to other participants' audio.
   */
  async connect(roomName: string, identity: string, name: string, metadata?: string): Promise<void> {
    const serverUrl = process.env.LIVEKIT_URL;
    if (!serverUrl) throw new Error("LIVEKIT_URL not configured");

    const token = await this.generateToken(roomName, identity, name, metadata);

    // Create and publish the audio track before connecting
    this.track = LocalAudioTrack.createAudioTrack("ai-voice", this.audioSource);

    // Handle LiveKit's built-in chat messages so the AI can respond to text too
    this.room.registerTextStreamHandler("lk.chat", async (reader, participantInfo) => {
      try {
        const text = await reader.readAll();
        if (text && this.onChatMessage) {
          this.onChatMessage(text, participantInfo.identity);
        }
      } catch {
        // ignore read errors on chat stream
      }
    });

    await this.room.connect(serverUrl, token, { autoSubscribe: true, dynacast: true });
    this.connected = true;

    // Publish our audio track so others can hear us
    await this.room.localParticipant!.publishTrack(this.track, {
      source: TrackSource.SOURCE_MICROPHONE,
    } as unknown as TrackPublishOptions);

    // Subscribe to audio from existing and future remote participants
    for (const [, participant] of this.room.remoteParticipants) {
      this.subscribeToParticipantAudio(participant.identity);
    }
    this.room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (track.kind === 1) { // TrackKind.KIND_AUDIO
        this.handleAudioTrack(track, participant.identity);
      }
    });

    logger.info({ roomName, identity }, "AI bot connected to LiveKit room");
  }

  /**
   * Subscribe to a specific participant's audio tracks.
   */
  private subscribeToParticipantAudio(identity: string) {
    const participant = this.room.remoteParticipants.get(identity);
    if (!participant) return;

    for (const [, pub] of participant.trackPublications) {
      if (pub.track && pub.track.kind === 1) { // KIND_AUDIO
        this.handleAudioTrack(pub.track, identity);
      }
    }
  }

  /**
   * Create an AudioStream from a remote track and forward frames.
   */
  private async handleAudioTrack(track: any, identity: string) {
    const stream = new AudioStream(track, SAMPLE_RATE, 1);
    const reader = stream.getReader();

    const readLoop = async () => {
      try {
        while (this.connected) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && this.onAudioFrame) {
            this.onAudioFrame(value, identity);
          }
        }
      } catch (err) {
        if (this.connected) {
          logger.error({ err, identity }, "Error reading audio stream");
        }
      }
    };

    void readLoop();
  }

  /**
   * Publish PCM audio (16-bit LE, 24kHz, mono) to the room.
   * Feeds the buffer in 20ms frames to maintain real-time pacing.
   */
  async publishAudio(pcmBuffer: Buffer): Promise<void> {
    if (!this.connected) return;

    const totalSamples = pcmBuffer.length / 2; // 16-bit = 2 bytes per sample
    let offset = 0;

    while (offset < totalSamples) {
      const chunkSamples = Math.min(SAMPLES_PER_FRAME, totalSamples - offset);
      const int16 = new Int16Array(chunkSamples);
      for (let i = 0; i < chunkSamples; i++) {
        int16[i] = pcmBuffer.readInt16LE((offset + i) * 2);
      }

      const frame = new AudioFrame(int16, SAMPLE_RATE, 1, chunkSamples);
      await this.audioSource.captureFrame(frame);
      offset += chunkSamples;
    }

    // Wait for playout to finish before returning
    await this.audioSource.waitForPlayout();
  }

  /**
   * Disconnect from the room and clean up.
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.track) {
      await this.track.close();
      this.track = null;
    }
    await this.audioSource.close();
    await this.room.disconnect();
    logger.info("AI bot disconnected from LiveKit room");
  }

  /**
   * Get a remote participant's display name from the LiveKit room.
   */
  getParticipantName(identity: string): string | undefined {
    return this.room.remoteParticipants.get(identity)?.name;
  }

  get isConnected(): boolean {
    return this.connected;
  }
}
