export interface AiAssistantConfig {
  userId: string;
  name: string;
  type: "wellness" | "health_specialist" | "friend";
  gender: "male" | "female";
  voiceId: string;
  systemPrompt: string;
}

export interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp: number;
  isAi: boolean;
}

export interface PipelineOptions {
  sessionId: string;
  roomName: string;
  language: string;
  assistant: AiAssistantConfig;
}
