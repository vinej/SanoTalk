import type { TranscriptSegment } from "./types.js";
import { logger } from "../logger.js";

/** Configuration for turn-taking behavior */
interface TurnConfig {
  /** Extra silence (ms) after utterance end before considering turn complete */
  postUtteranceSilence: number;
  /** Minimum seconds between AI responses (reset if directly addressed) */
  cooldownMs: number;
  /** Reduced cooldown when directly addressed by name */
  directAddressCooldownMs: number;
  /** Seconds of inactivity before AI offers a gentle prompt */
  inactivityPromptMs: number;
  /** Maximum transcript segments kept in context window */
  maxContextSegments: number;
}

const DEFAULT_CONFIG: TurnConfig = {
  postUtteranceSilence: 500,
  cooldownMs: 10_000,
  directAddressCooldownMs: 3_000,
  inactivityPromptMs: 30_000,
  maxContextSegments: 20,
};

export type TurnDecision =
  | { shouldRespond: false }
  | { shouldRespond: true; reason: "direct_address" | "question" | "continuation" | "inactivity"; context: TranscriptSegment[] };

export class TurnManager {
  private config: TurnConfig;
  private segments: TranscriptSegment[] = [];
  private lastAiSpokeAt = 0;
  private lastHumanSpokeAt = 0;
  private humanRespondedSinceAi = true;
  private assistantName: string;
  private assistantNameVariants: string[];
  private aiUserIds: Set<string>;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  /** Called when the turn manager decides the AI should speak */
  onShouldRespond?: (decision: TurnDecision & { shouldRespond: true }) => void;

  /** Called when inactivity timeout is reached */
  onInactivityPrompt?: () => void;

  constructor(
    assistantName: string,
    aiUserIds: string[],
    config?: Partial<TurnConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.assistantName = assistantName;
    this.assistantNameVariants = [
      assistantName.toLowerCase(),
      // Handle common shortened forms
      ...assistantName.toLowerCase().split(" "),
    ].filter((v) => v.length > 2);
    this.aiUserIds = new Set(aiUserIds);
  }

  /**
   * Feed a completed transcript segment from a human speaker.
   * The turn manager accumulates context and decides when the AI should respond.
   */
  addSegment(segment: TranscriptSegment): void {
    // Ignore AI-generated segments (prevent AI-to-AI loops)
    if (segment.isAi || this.aiUserIds.has(segment.speaker)) return;

    this.segments.push(segment);
    if (this.segments.length > this.config.maxContextSegments) {
      this.segments.shift();
    }

    this.lastHumanSpokeAt = Date.now();
    this.resetInactivityTimer();

    // Clear previous silence timer and start a new one
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      this.evaluateTurn();
    }, this.config.postUtteranceSilence);
  }

  /**
   * Notify the turn manager that the AI just finished speaking.
   */
  markAiSpoke(): void {
    this.lastAiSpokeAt = Date.now();
    this.humanRespondedSinceAi = false;
    this.resetInactivityTimer();
  }

  /**
   * Notify that someone is currently speaking (interim transcript received).
   * Cancels any pending turn evaluation to avoid interrupting.
   */
  markSpeaking(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /**
   * Get the current conversation context for LLM inference.
   */
  getContext(): TranscriptSegment[] {
    return [...this.segments];
  }

  /**
   * Evaluate whether the AI should respond now.
   */
  private evaluateTurn(): void {
    if (this.segments.length === 0) return;

    const lastSegment = this.segments[this.segments.length - 1]!;
    const textLower = lastSegment.text.toLowerCase();
    const now = Date.now();

    // Check for direct address (name mentioned)
    const isDirectAddress = this.assistantNameVariants.some((name) =>
      textLower.includes(name)
    );

    // If directly addressed, skip cooldown
    if (isDirectAddress) {
      const effectiveCooldown = this.config.directAddressCooldownMs;
      if (now - this.lastAiSpokeAt < effectiveCooldown) return;

      logger.debug({ text: lastSegment.text }, "AI directly addressed");
      this.onShouldRespond?.({
        shouldRespond: true,
        reason: "direct_address",
        context: this.getContext(),
      });
      return;
    }

    // Conversation continuation — user responding to something the AI just said.
    // The AI's system prompt always ends with a follow-up question, so the user's
    // reply (even a short affirmation) should keep the conversation flowing.
    if (!this.humanRespondedSinceAi && this.lastAiSpokeAt > 0) {
      const sinceLast = now - this.lastAiSpokeAt;
      if (sinceLast > this.config.directAddressCooldownMs) {
        this.humanRespondedSinceAi = true;
        logger.debug({ text: lastSegment.text }, "Conversation continuation detected");
        this.onShouldRespond?.({
          shouldRespond: true,
          reason: "continuation",
          context: this.getContext(),
        });
        return;
      }
    }

    // Apply standard cooldown
    if (now - this.lastAiSpokeAt < this.config.cooldownMs) return;

    // Check for question
    const isQuestion =
      textLower.endsWith("?") ||
      /\b(what do you think|any thoughts|can you help|what about|how about|do you know)\b/i.test(
        lastSegment.text
      );

    if (isQuestion) {
      logger.debug({ text: lastSegment.text }, "Question detected");
      this.onShouldRespond?.({
        shouldRespond: true,
        reason: "question",
        context: this.getContext(),
      });
      return;
    }
  }

  /**
   * Reset the inactivity timer. When it fires, the AI may offer a gentle prompt.
   */
  private resetInactivityTimer(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => {
      // Only prompt if there have been segments and AI hasn't spoken recently
      if (
        this.segments.length > 0 &&
        Date.now() - this.lastAiSpokeAt > this.config.inactivityPromptMs
      ) {
        this.onInactivityPrompt?.();
      }
    }, this.config.inactivityPromptMs);
  }

  /**
   * Clean up timers.
   */
  destroy(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
  }
}
