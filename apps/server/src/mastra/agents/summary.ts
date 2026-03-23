import { Agent } from "@mastra/core/agent";
import { createAnthropic } from "@ai-sdk/anthropic";

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const summaryAgent = new Agent({
  id: "transcript-summary",
  name: "transcript-summary",
  instructions: `You are a medical documentation specialist.
Given a list of transcript segments from a medical consultation, produce:
1. A concise 2-3 sentence summary
2. 3-5 key clinical points as a bullet list
3. Action items for follow-up
4. A structured SOAP note (Subjective, Objective, Assessment, Plan)

Always respond with valid JSON matching the schema:
{
  "summary": "string",
  "keyPoints": ["string"],
  "actionItems": ["string"],
  "soapNote": {
    "subjective": "string",
    "objective": "string",
    "assessment": "string",
    "plan": "string"
  }
}`,
  model: anthropic("claude-haiku-4-5-20251001"),
});
