import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { logger } from "../logger.js";

export const provider = process.env.AI_PROVIDER ?? "anthropic";

const DEFAULTS: Record<string, { large: string; small: string }> = {
  anthropic: { large: "claude-sonnet-4-6", small: "claude-haiku-4-5-20251001" },
  openai:    { large: "gpt-4o",            small: "gpt-4o-mini" },
  ollama:    { large: "gemma3",            small: "gemma3" },
};

const defaults = (DEFAULTS[provider] ?? DEFAULTS.anthropic)!;
export const largeModelId = process.env.AI_MODEL_LARGE ?? defaults.large;
export const smallModelId = process.env.AI_MODEL_SMALL ?? defaults.small;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createModel(modelId: string): any {
  if (provider === "ollama") {
    const ollama = createOpenAI({
      baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
      apiKey: "ollama",
    });
    return ollama(modelId);
  }

  if (provider === "openai") {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    return openai(modelId);
  }

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return anthropic(modelId);
}

/** For chat agents (companion, health) — high quality */
export const largeModel = createModel(largeModelId);

/** For summary/SOAP agents — fast and cheap */
export const smallModel = createModel(smallModelId);

logger.info({ provider, largeModelId, smallModelId }, "AI configuration loaded");
