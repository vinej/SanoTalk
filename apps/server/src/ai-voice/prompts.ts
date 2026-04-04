import type { AiAssistantConfig } from "./types.js";

/**
 * Wraps the assistant's stored system prompt with live session context:
 * language, participant names, and the assistant's own name.
 */
export function buildSessionPrompt(
  assistant: AiAssistantConfig,
  language: string,
  participantNames: string[]
): string {
  const contextBlock = [
    "LIVE SESSION CONTEXT:",
    `- Session language: ${language}`,
    `- Your name: ${assistant.name}`,
    `- Other participants: ${participantNames.length > 0 ? participantNames.join(", ") : "none yet"}`,
    `- You MUST respond in ${language === "fr" ? "French" : language === "es" ? "Spanish" : language === "zh" ? "Mandarin Chinese" : language === "ar" ? "Arabic" : language === "hi" ? "Hindi" : "English"}`,
  ].join("\n");

  return `${assistant.systemPrompt}\n\n${contextBlock}`;
}
