import { Agent } from "@mastra/core/agent";
import { openai } from "@mastra/openai";
import { db, transcript, transcriptSummary } from "@sanotalk/db";
import { eq } from "drizzle-orm";

export const summaryAgent = new Agent({
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
  model: openai("gpt-4o"),
  tools: {},
});
