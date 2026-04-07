import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { Agent } from "@mastra/core/agent";
import { largeModel } from "../mastra/model.js";
import { logger } from "../logger.js";
import { LiveKitBot } from "./livekit-bot.js";
import { TurnManager, type TurnDecision } from "./turn-manager.js";
import { synthesize } from "./tts-service.js";
import { buildSessionPrompt } from "./prompts.js";
import type { AiAssistantConfig, PipelineOptions, TranscriptSegment } from "./types.js";
import { db, transcript as transcriptTable } from "@sanotalk/db";

/**
 * AiVoicePipeline manages the full lifecycle of an AI participant in a session:
 *   LiveKit audio → Deepgram STT → Turn Manager → LLM → TTS → LiveKit audio
 */
export class AiVoicePipeline {
  private bot: LiveKitBot;
  private turnManager: TurnManager;
  private agent: Agent;
  private options: PipelineOptions;
  private running = false;
  private speaking = false;

  // Deepgram STT for processing room audio
  private dgConnection: any = null;
  private accumulatedText = "";
  private lastSpeakerIdentity = "unknown";

  constructor(options: PipelineOptions, allAiUserIds: string[]) {
    this.options = options;
    this.bot = new LiveKitBot();
    this.turnManager = new TurnManager(options.assistant.name, allAiUserIds);

    // Create a dedicated Mastra agent with this assistant's system prompt
    const sessionPrompt = buildSessionPrompt(
      options.assistant,
      options.language,
      [] // participant names filled dynamically
    );
    this.agent = new Agent({
      id: `voice-${options.assistant.userId}`,
      name: options.assistant.name,
      instructions: sessionPrompt,
      model: largeModel,
    });

    this.setupTurnCallbacks();
  }

  private setupTurnCallbacks(): void {
    this.turnManager.onShouldRespond = (decision) => {
      void this.handleTurnDecision(decision);
    };

    this.turnManager.onInactivityPrompt = () => {
      void this.handleInactivityPrompt();
    };
  }

  /**
   * Start the pipeline: connect to room, set up STT, begin listening.
   */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    const { assistant, roomName } = this.options;

    let audioFrameLogCount = 0;
    // Connect bot to LiveKit room
    this.bot.onAudioFrame = (frame, participantIdentity) => {
      // Don't process our own audio
      if (participantIdentity === assistant.userId) return;
      if (audioFrameLogCount === 0) {
        logger.info({ from: participantIdentity, samples: frame.samplesPerChannel, sampleRate: frame.sampleRate }, "First audio frame received from participant");
      }
      audioFrameLogCount++;

      // Track who is actively speaking (simple RMS energy check to ignore silence)
      const samples = frame.data as Int16Array;
      let sumSq = 0;
      for (let i = 0; i < samples.length; i++) sumSq += samples[i]! * samples[i]!;
      const rms = Math.sqrt(sumSq / samples.length);
      if (rms > 300) {
        this.lastSpeakerIdentity = participantIdentity;
      }

      this.feedAudioToSTT(frame);
    };

    // Handle LiveKit text chat messages — treat them like speech for the AI
    this.bot.onChatMessage = (text, participantIdentity) => {
      if (participantIdentity === assistant.userId) return;
      const speakerName = this.bot.getParticipantName(participantIdentity) ?? participantIdentity;
      const segment: TranscriptSegment = {
        speaker: speakerName,
        text,
        timestamp: Date.now(),
        isAi: false,
      };
      this.turnManager.addSegment(segment);
      void this.storeTranscript(text, participantIdentity);
      logger.info({ from: speakerName, text }, "Chat message received by AI");
    };

    // Use the server-side avatar proxy for MinIO keys; external URLs (DiceBear) pass through
    const avatarUrl = assistant.image
      ? (assistant.image.startsWith("http://") || assistant.image.startsWith("https://")
          ? assistant.image
          : `/api/avatar/${assistant.userId}?v=${encodeURIComponent(assistant.image)}`)
      : null;
    const metadata = JSON.stringify({ avatarUrl });
    await this.bot.connect(roomName, assistant.userId, assistant.name, metadata);

    // Set up Deepgram for server-side STT of room audio
    this.setupDeepgramSTT();

    logger.info(
      { sessionId: this.options.sessionId, assistant: assistant.name },
      "AI voice pipeline started"
    );
  }

  /**
   * Set up a Deepgram live transcription connection for processing room audio.
   */
  private setupDeepgramSTT(): void {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY ?? "");
    const langMap: Record<string, string> = {
      en: "en-US", fr: "fr-CA", es: "es", zh: "zh", ar: "ar", hi: "hi",
    };

    this.dgConnection = deepgram.listen.live({
      model: "nova-2",
      language: langMap[this.options.language] ?? "en-US",
      encoding: "linear16",
      sample_rate: 24000,
      channels: 1,
      smart_format: true,
      diarize: true,
      punctuate: true,
      interim_results: true,
      utterance_end_ms: 2000,
    });

    this.dgConnection.on(LiveTranscriptionEvents.Error, (err: any) => {
      logger.error({ err }, "AI voice pipeline Deepgram error");
    });

    this.dgConnection.on(LiveTranscriptionEvents.Open, () => {
      logger.info("AI voice pipeline Deepgram connection opened");

      this.dgConnection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        const alt = data.channel?.alternatives?.[0];
        if (!alt) return;

        const transcript = alt.transcript?.trim();
        if (transcript) {
          logger.info(
            { isFinal: data.is_final, transcript, confidence: alt.confidence },
            "Deepgram STT transcript received"
          );
        }

        if (data.is_final && transcript) {
          this.accumulatedText += (this.accumulatedText ? " " : "") + transcript;
          this.turnManager.markSpeaking();
        } else if (!data.is_final && transcript) {
          // Interim: someone is actively speaking
          this.turnManager.markSpeaking();
        }
      });

      this.dgConnection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
        logger.info({ accumulatedText: this.accumulatedText, speaker: this.lastSpeakerIdentity }, "Deepgram UtteranceEnd event");
        if (this.accumulatedText.trim()) {
          const speakerId = this.lastSpeakerIdentity;
          const speakerName = this.bot.getParticipantName(speakerId) ?? speakerId;
          const segment: TranscriptSegment = {
            speaker: speakerName,
            text: this.accumulatedText.trim(),
            timestamp: Date.now(),
            isAi: false,
          };
          this.turnManager.addSegment(segment);
          // Not storing to DB here — the browser's transcript socket already saves human speech
          this.accumulatedText = "";
        }
      });
    });
  }

  /**
   * Feed PCM audio frames from LiveKit into Deepgram STT.
   */
  private frameCount = 0;

  private feedAudioToSTT(frame: any): void {
    const readyState = this.dgConnection?.getReadyState?.();
    if (!this.dgConnection || readyState !== 1) {
      if (this.frameCount % 500 === 0) {
        logger.warn({ readyState, hasConnection: !!this.dgConnection }, "Deepgram not ready, dropping audio frames");
      }
      this.frameCount++;
      return;
    }

    // AudioFrame.data is Int16Array — convert to raw bytes for Deepgram
    const buffer = Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
    this.dgConnection.send(buffer);

    this.frameCount++;
    if (this.frameCount % 500 === 0) {
      logger.debug({ frameCount: this.frameCount, bufferBytes: buffer.length }, "Feeding audio to Deepgram STT");
    }
  }

  /**
   * Handle the turn manager's decision that the AI should respond.
   */
  private async handleTurnDecision(
    decision: TurnDecision & { shouldRespond: true }
  ): Promise<void> {
    if (this.speaking || !this.running) return;
    this.speaking = true;

    try {
      const contextText = decision.context
        .map((s) => `${s.speaker}: ${s.text}`)
        .join("\n");

      const messages: Array<{ role: "user" | "assistant"; content: string }> = [
        {
          role: "user",
          content: `Here is the recent conversation:\n\n${contextText}\n\nRespond naturally as ${this.options.assistant.name}. Keep it short and conversational.`,
        },
      ];

      logger.info(
        { assistant: this.options.assistant.name, reason: decision.reason },
        "AI generating voice response"
      );

      const result = await this.agent.generate(messages as any);
      const responseText = result.text;

      if (!responseText || !this.running) {
        this.speaking = false;
        return;
      }

      // Store the AI's response as a transcript entry
      await this.storeTranscript(responseText);

      // Synthesize speech and publish to room
      const { pcm } = await synthesize(responseText, this.options.assistant.voiceId, this.options.language);
      logger.info(
        { assistant: this.options.assistant.name, pcmBytes: pcm.length, durationMs: Math.round((pcm.length / 2 / 24000) * 1000) },
        "TTS done, publishing audio to LiveKit"
      );
      await this.bot.publishAudio(pcm);
      logger.info({ assistant: this.options.assistant.name }, "Audio published to LiveKit");

      this.turnManager.markAiSpoke();

      logger.info(
        { assistant: this.options.assistant.name, responseLength: responseText.length },
        "AI voice response delivered"
      );
    } catch (err) {
      logger.error({ err, assistant: this.options.assistant.name }, "Error generating AI voice response");
    } finally {
      this.speaking = false;
    }
  }

  /**
   * Handle inactivity — offer a gentle prompt.
   */
  private async handleInactivityPrompt(): Promise<void> {
    if (this.speaking || !this.running) return;
    this.speaking = true;

    try {
      const messages: Array<{ role: "user" | "assistant"; content: string }> = [
        {
          role: "user",
          content: `It's been quiet for a while. As ${this.options.assistant.name}, offer a gentle, brief prompt to re-engage the conversation. One sentence only.`,
        },
      ];

      const result = await this.agent.generate(messages as any);
      const text = result.text;

      if (text && this.running) {
        await this.storeTranscript(text);
        const { pcm } = await synthesize(text, this.options.assistant.voiceId, this.options.language);
        await this.bot.publishAudio(pcm);
        this.turnManager.markAiSpoke();
      }
    } catch (err) {
      logger.error({ err }, "Error generating inactivity prompt");
    } finally {
      this.speaking = false;
    }
  }

  /**
   * Store a transcript entry. Defaults to the AI assistant as speaker.
   */
  private async storeTranscript(text: string, speakerId?: string): Promise<void> {
    try {
      await db.insert(transcriptTable).values({
        sessionId: this.options.sessionId,
        speakerId: speakerId ?? this.options.assistant.userId,
        content: text,
        confidence: 1.0,
        startMs: Date.now(),
        endMs: Date.now(),
      });
    } catch (err) {
      logger.error({ err }, "Failed to store AI transcript");
    }
  }

  /**
   * Stop the pipeline and disconnect.
   */
  async stop(): Promise<void> {
    this.running = false;
    this.turnManager.destroy();
    if (this.dgConnection) {
      try { this.dgConnection.requestClose(); } catch { /* ignore */ }
    }
    await this.bot.disconnect();

    logger.info(
      { sessionId: this.options.sessionId, assistant: this.options.assistant.name },
      "AI voice pipeline stopped"
    );
  }

  get isRunning(): boolean {
    return this.running;
  }
}
