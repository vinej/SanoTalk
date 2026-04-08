import type { AiAssistantConfig } from "./types.js";

/** Strip control characters and limit length to prevent prompt injection. */
function sanitizeName(name: string): string {
  return name.replace(/[\n\r\x00-\x1F\x7F]/g, "").slice(0, 50).trim() || "Unknown";
}

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
  const safeName = sanitizeName(assistant.name);
  const safeParticipants = participantNames.map(sanitizeName);
  const participantsStr =
    safeParticipants.length > 0 ? safeParticipants.join(", ") : "none yet";

  if (language === "en" || !LANG_NAMES[language]) {
    // English — no extra wrapping needed
    return [
      assistant.systemPrompt,
      "",
      "LIVE SESSION CONTEXT:",
      `- Your name: ${safeName}`,
      `- Other participants: ${participantsStr}`,
    ].join("\n");
  }

  // Non-English: sandwich language instruction around the base prompt
  const prefix = `IMPORTANT: This is a ${langName}-language session. You MUST speak ONLY in ${langName}. Every word of every response must be in ${langName}. Do NOT use English.`;

  const context = [
    "LIVE SESSION CONTEXT:",
    `- Session language: ${langName}`,
    `- Your name: ${safeName}`,
    `- Other participants: ${participantsStr}`,
    `- REMINDER: Respond ONLY in ${langName}.`,
  ].join("\n");

  const safeSystemPrompt = assistant.systemPrompt.replace(/<\/?system_instructions>/gi, "");
  return `${prefix}\n\n<system_instructions>\n${safeSystemPrompt}\n</system_instructions>\n\n${context}`;
}
