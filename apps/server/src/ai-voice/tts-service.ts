import { createClient } from "@deepgram/sdk";
import { logger } from "../logger.js";

const SAMPLE_RATE = 24000; // Deepgram Aura outputs at the requested sample rate

/**
 * Synthesize text to raw PCM 16-bit LE audio at 24 kHz mono using Deepgram TTS (Aura).
 * Uses the existing DEEPGRAM_API_KEY — no additional API key needed.
 *
 * Deepgram Aura voices used:
 *   aura-orion-en   (male)    — Marcus (wellness)
 *   aura-asteria-en (female)  — Sophia (wellness)
 *   aura-arcas-en   (male)    — James  (health specialist)
 *   aura-luna-en    (female)  — Elena  (health specialist)
 *   aura-stella-en  (female)  — Lily   (friend)
 *   aura-helios-en  (male)    — Ethan  (friend)
 */
export async function synthesize(
  text: string,
  voiceId: string
): Promise<{ pcm: Buffer; sampleRate: number }> {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY ?? "");

  const response = await deepgram.speak.request(
    { text },
    {
      model: voiceId,
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
    { voiceId, textLength: text.length, pcmBytes: pcm.length },
    "TTS synthesis complete"
  );

  return { pcm, sampleRate: SAMPLE_RATE };
}

export { SAMPLE_RATE };
