import { Agent } from "@mastra/core/agent";
import { openai } from "@mastra/openai";

export const soapNoteAgent = new Agent({
  name: "soap-note",
  instructions: `You are an expert medical scribe. 
Convert the provided consultation transcript into a detailed, structured SOAP note.
Output strict JSON only.`,
  model: openai("gpt-4o"),
  tools: {},
});
