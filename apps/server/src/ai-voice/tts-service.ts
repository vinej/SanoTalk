import { createClient } from "@deepgram/sdk";
import { logger } from "../logger.js";

const SAMPLE_RATE = 24000; // Deepgram Aura outputs at the requested sample rate

/**
 * Synthesize text to raw PCM 16-bit LE audio at 24 kHz mono using Deepgram TTS (Aura).
 * Uses the existing DEEPGRAM_API_KEY — no additional API key needed.
 *
 * English voices (default):
 *   aura-orion-en   (male)    — Marcus (wellness)
 *   aura-asteria-en (female)  — Sophia (wellness)
 *   aura-arcas-en   (male)    — James  (health specialist)
 *   aura-luna-en    (female)  — Elena  (health specialist)
 *   aura-stella-en  (female)  — Lily   (friend)
 *   aura-helios-en  (male)    — Ethan  (friend)
 *
 * For non-English sessions the voice is mapped to a language-appropriate
 * equivalent when available (see VOICE_LANG_MAP below).
 */

// Map base English voice → per-language alternative.
//
// Deepgram Aura 2 has multilingual voices (e.g. "agathe", "aurelia" for
// French) but they require a plan upgrade (403 on free/starter plans).
// Until upgraded, the English Aura 1 voices will read French text — the
// pronunciation is accented but functional.
//
// To switch to native French voices once your Deepgram plan supports Aura 2,
// uncomment the mapping below:
const VOICE_LANG_MAP: Record<string, Record<string, string>> = {
  // fr: {
  //   "aura-orion-en":   "aura-2-en-apollo",   // male
  //   "aura-asteria-en": "aura-2-en-agathe",   // female, French name
  //   "aura-arcas-en":   "aura-2-en-cesare",   // male
  //   "aura-luna-en":    "aura-2-en-aurelia",   // female
  //   "aura-stella-en":  "aura-2-en-diana",    // female
  //   "aura-helios-en":  "aura-2-en-hector",   // male
  // },
};

/**
 * Resolve the best voice ID for the given language.
 * Falls back to the original (English) voice if no mapping exists.
 */
function resolveVoice(baseVoiceId: string, language: string): string {
  return VOICE_LANG_MAP[language]?.[baseVoiceId] ?? baseVoiceId;
}

export async function synthesize(
  text: string,
  voiceId: string,
  language = "en"
): Promise<{ pcm: Buffer; sampleRate: number }> {
  const MAX_TTS_LENGTH = 1500; // ~30 seconds of speech
  const safeText = text.length > MAX_TTS_LENGTH
    ? text.slice(0, MAX_TTS_LENGTH) + "…"
    : text;

  const deepgram = createClient(process.env.DEEPGRAM_API_KEY ?? "");
  const resolvedVoice = resolveVoice(voiceId, language);

  const response = await deepgram.speak.request(
    { text: safeText },
    {
      model: resolvedVoice,
      encoding: "linear16", // raw 16-bit PCM
      sample_rate: SAMPLE_RATE,
      container: "none",    // raw PCM without WAV header
    }
  );

  const stream = await response.getStream();
  if (!stream) throw new Error("Deepgram TTS returned no audio stream");

  // Collect all chunks from the ReadableStream into a Buffer
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const pcm = Buffer.concat(chunks);

  logger.info(
    { voiceId: resolvedVoice, language, textLength: text.length, pcmBytes: pcm.length },
    "TTS synthesis complete"
  );

  return { pcm, sampleRate: SAMPLE_RATE };
}

export { SAMPLE_RATE };
