import { db, user, aiAssistantProfile, talkSession } from "@sanotalk/db";
import { eq } from "drizzle-orm";
import { AiVoicePipeline } from "./pipeline.js";
import type { AiAssistantConfig, PipelineOptions } from "./types.js";
import { logger } from "../logger.js";

/** Map of "sessionId:userId" → active pipeline */
const activePipelines = new Map<string, AiVoicePipeline>();

function pipelineKey(sessionId: string, userId: string): string {
  return `${sessionId}:${userId}`;
}

/**
 * Load the AI assistant's profile from the database.
 */
async function loadAssistantConfig(userId: string): Promise<AiAssistantConfig | null> {
  const profile = await db.query.aiAssistantProfile.findFirst({
    where: eq(aiAssistantProfile.userId, userId),
    with: { user: { columns: { id: true, name: true } } },
  });
  if (!profile) return null;

  return {
    userId: profile.user.id,
    name: profile.user.name,
    type: profile.type as AiAssistantConfig["type"],
    gender: profile.gender as AiAssistantConfig["gender"],
    voiceId: profile.voiceId,
    systemPrompt: profile.systemPrompt,
  };
}

/**
 * Get all AI assistant user IDs (used to prevent AI-to-AI responses).
 */
async function getAllAiUserIds(): Promise<string[]> {
  const profiles = await db.query.aiAssistantProfile.findMany({
    columns: {},
    with: { user: { columns: { id: true } } },
  });
  return profiles.map((p) => p.user.id);
}

/**
 * Join an AI assistant to a session's LiveKit room.
 * Called when addParticipant is triggered for an ia_agent user while the session is active.
 */
export async function joinAiParticipant(sessionId: string, aiUserId: string): Promise<void> {
  const key = pipelineKey(sessionId, aiUserId);

  // Already active
  if (activePipelines.has(key)) {
    logger.warn({ sessionId, aiUserId }, "AI participant already active in session");
    return;
  }

  // Load assistant config
  const assistant = await loadAssistantConfig(aiUserId);
  if (!assistant) {
    logger.error({ aiUserId }, "AI assistant profile not found");
    return;
  }

  // Load session to get roomName and language
  const session = await db.query.talkSession.findFirst({
    where: eq(talkSession.id, sessionId),
  });
  if (!session) {
    logger.error({ sessionId }, "Session not found for AI participant join");
    return;
  }

  const allAiIds = await getAllAiUserIds();

  const options: PipelineOptions = {
    sessionId,
    roomName: session.roomName,
    language: session.language,
    assistant,
  };

  const pipeline = new AiVoicePipeline(options, allAiIds);
  activePipelines.set(key, pipeline);

  try {
    await pipeline.start();
    logger.info({ sessionId, assistant: assistant.name }, "AI participant joined session");
  } catch (err) {
    logger.error({ err, sessionId, aiUserId }, "Failed to start AI voice pipeline");
    activePipelines.delete(key);
  }
}

/**
 * Remove an AI assistant from a session.
 */
export async function removeAiParticipant(sessionId: string, aiUserId: string): Promise<void> {
  const key = pipelineKey(sessionId, aiUserId);
  const pipeline = activePipelines.get(key);
  if (!pipeline) return;

  await pipeline.stop();
  activePipelines.delete(key);
  logger.info({ sessionId, aiUserId }, "AI participant removed from session");
}

/**
 * Remove all AI participants from a session (called when session ends).
 */
export async function removeAllAiParticipants(sessionId: string): Promise<void> {
  const toRemove: string[] = [];
  for (const [key, pipeline] of activePipelines) {
    if (key.startsWith(`${sessionId}:`)) {
      await pipeline.stop();
      toRemove.push(key);
    }
  }
  for (const key of toRemove) {
    activePipelines.delete(key);
  }
  if (toRemove.length > 0) {
    logger.info({ sessionId, count: toRemove.length }, "All AI participants removed from session");
  }
}

/**
 * Check if a user is an AI assistant.
 */
export async function isAiAssistant(userId: string): Promise<boolean> {
  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { role: true },
  });
  return row?.role === "ia_agent";
}
