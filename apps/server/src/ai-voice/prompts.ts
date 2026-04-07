import type { AiAssistantConfig } from "./types.js";

const LANG_NAMES: Record<string, string> = {
  fr: "French",
  es: "Spanish",
  zh: "Mandarin Chinese",
  ar: "Arabic",
  hi: "Hindi",
};

/**
 * Wraps the assistant's stored system prompt with live session context:
 * language, participant names, and the assistant's own name.
 *
 * For non-English sessions the language instruction is placed both before
 * and after the base system prompt ("sandwich" technique) so the LLM
 * reliably responds in the correct language.
 */
export function buildSessionPrompt(
  assistant: AiAssistantConfig,
  language: string,
  participantNames: string[]
): string {
  const langName = LANG_NAMES[language] ?? "English";
  const participantsStr =
    participantNames.length > 0 ? participantNames.join(", ") : "none yet";

  if (language === "en" || !LANG_NAMES[language]) {
    // English — no extra wrapping needed
    return [
      assistant.systemPrompt,
      "",
      "LIVE SESSION CONTEXT:",
      `- Your name: ${assistant.name}`,
      `- Other participants: ${participantsStr}`,
    ].join("\n");
  }

  // Non-English: sandwich language instruction around the base prompt
  const prefix = `IMPORTANT: This is a ${langName}-language session. You MUST speak ONLY in ${langName}. Every word of every response must be in ${langName}. Do NOT use English.`;

  const context = [
    "LIVE SESSION CONTEXT:",
    `- Session language: ${langName}`,
    `- Your name: ${assistant.name}`,
    `- Other participants: ${participantsStr}`,
    `- REMINDER: Respond ONLY in ${langName}.`,
  ].join("\n");

  return `${prefix}\n\n${assistant.systemPrompt}\n\n${context}`;
}
