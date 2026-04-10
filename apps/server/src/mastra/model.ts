import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { logger } from "../logger.js";

export const provider = process.env.AI_PROVIDER ?? "anthropic";

const DEFAULTS: Record<string, { large: string; small: string }> = {
  anthropic: { large: "claude-sonnet-4-6", small: "claude-haiku-4-5-20251001" },
  openai:    { large: "gpt-4o",            small: "gpt-4o-mini" },
  ollama:    { large: "gemma4",            small: "gemma4" },
};

const defaults = (DEFAULTS[provider] ?? DEFAULTS.anthropic)!;
export const largeModelId = process.env.AI_MODEL_LARGE ?? defaults.large;
export const smallModelId = process.env.AI_MODEL_SMALL ?? defaults.small;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createProviderModel(p: string, modelId: string): any {
  if (p === "ollama") {
    const ollama = createOpenAI({
      baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
      apiKey: "ollama",
    });
    return ollama(modelId);
  }

  if (p === "openai") {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    return openai(modelId);
  }

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return anthropic(modelId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createModel(modelId: string): any {
  return createProviderModel(provider, modelId);
}

/** For chat agents (companion, health) — high quality */
export const largeModel = createModel(largeModelId);

/** For summary/SOAP agents — fast and cheap */
export const smallModel = createModel(smallModelId);

// ─── Test Agent model override ─────────────────────────────────────────────
// Route the admin-only Test AI Agent to a different provider (typically local
// Ollama) without touching the global AI_PROVIDER. Useful for local testing
// of docs-mode pipelines against a rate-limit-free local LLM while the rest
// of the app stays on Anthropic/OpenAI.
const testAgentProviderEnv = process.env.TEST_AGENT_PROVIDER;
const testAgentModelEnv = process.env.TEST_AGENT_MODEL;
const testAgentOverrideActive = !!(testAgentProviderEnv || testAgentModelEnv);
const testAgentProvider = testAgentProviderEnv ?? provider;
const testAgentModelId =
  testAgentModelEnv ?? (DEFAULTS[testAgentProvider] ?? DEFAULTS.anthropic)!.large;

/**
 * Model used by testChatAgent. Falls back to `largeModel` when no override
 * env vars are set, so default behavior is unchanged.
 */
export const testAgentModel = testAgentOverrideActive
  ? createProviderModel(testAgentProvider, testAgentModelId)
  : largeModel;

logger.info({ provider, largeModelId, smallModelId }, "AI configuration loaded");
if (testAgentOverrideActive) {
  logger.info(
    { provider: testAgentProvider, model: testAgentModelId },
    "Test Agent model override active — bypassing global AI_PROVIDER for testChatAgent"
  );
}
