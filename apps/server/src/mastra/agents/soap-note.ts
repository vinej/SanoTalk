import { Agent } from "@mastra/core/agent";

export const soapNoteAgent = new Agent({
  id: "soap-note",
  name: "soap-note",
  instructions: `You are an expert medical scribe. 
Convert the provided consultation transcript into a detailed, structured SOAP note.
Output strict JSON only.`,
  model: 'openai/gpt-4',
});
