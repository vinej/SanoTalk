import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

const provider = process.env.AI_PROVIDER ?? "anthropic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createModel(modelEnvVar: string, anthropicDefault: string, openaiDefault: string): any {
  const modelId = process.env[modelEnvVar];

  if (provider === "openai") {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    return openai(modelId ?? openaiDefault);
  }

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return anthropic(modelId ?? anthropicDefault);
}

/** For chat agents (companion, health) — high quality */
export const largeModel = createModel(
  "AI_MODEL_LARGE",
  "claude-sonnet-4-6",
  "gpt-4o"
);

/** For summary/SOAP agents — fast and cheap */
export const smallModel = createModel(
  "AI_MODEL_SMALL",
  "claude-haiku-4-5-20251001",
  "gpt-4o-mini"
);
