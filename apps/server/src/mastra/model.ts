import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { logger } from "../logger.js";

export const provider = process.env.AI_PROVIDER ?? "anthropic";

const DEFAULTS: Record<string, { large: string; small: string }> = {
  anthropic:  { large: "claude-sonnet-4-6",            small: "claude-haiku-4-5-20251001" },
  openai:     { large: "gpt-4o",                       small: "gpt-4o-mini" },
  ollama:     { large: "gemma4",                       small: "gemma4" },
  groq:       { large: "llama-3.3-70b-versatile",      small: "llama-3.1-8b-instant" },
  openrouter: { large: "anthropic/claude-sonnet-4.5",  small: "anthropic/claude-haiku-4.5" },
  gemini:     { large: "gemini-2.5-pro",               small: "gemini-2.5-flash" },
  github:     { large: "gpt-4o",                       small: "gpt-4o-mini" },
};

const defaults = (DEFAULTS[provider] ?? DEFAULTS.anthropic)!;
export const largeModelId = process.env.AI_MODEL_LARGE ?? defaults.large;
export const smallModelId = process.env.AI_MODEL_SMALL ?? defaults.small;

// Set USE_TOOLS=no when running against a model that doesn't support native
// tool calling (e.g. Gemma / MedGemma on Ollama). Agents will drop their
// tool definitions and rely on the base model only. Defaults to yes.
export const useTools = (process.env.USE_TOOLS ?? "yes").toLowerCase() !== "no";

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

  if (p === "groq") {
    const groq = createOpenAI({
      baseURL: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY!,
    });
    return groq(modelId);
  }

  if (p === "openrouter") {
    const openrouter = createOpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY!,
      headers: {
        ...(process.env.OPENROUTER_REFERER ? { "HTTP-Referer": process.env.OPENROUTER_REFERER } : {}),
        ...(process.env.OPENROUTER_TITLE ? { "X-Title": process.env.OPENROUTER_TITLE } : {}),
      },
    });
    return openrouter(modelId);
  }

  if (p === "gemini") {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    });
    return google(modelId);
  }

  if (p === "github") {
    const github = createOpenAI({
      baseURL: process.env.GITHUB_MODELS_BASE_URL ?? "https://models.github.ai/inference",
      apiKey: process.env.GITHUB_TOKEN!,
    });
    return github(modelId);
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

logger.info({ provider, largeModelId, smallModelId, useTools }, "AI configuration loaded");
if (testAgentOverrideActive) {
  logger.info(
    { provider: testAgentProvider, model: testAgentModelId },
    "Test Agent model override active — bypassing global AI_PROVIDER for testChatAgent"
  );
}
