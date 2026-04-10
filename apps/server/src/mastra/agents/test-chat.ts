import { Agent } from "@mastra/core/agent";
import { testAgentModel } from "../model.js";

export const testChatAgent = new Agent({
  id: "testChatAgent",
  name: "testChatAgent",
  instructions: "",
  model: testAgentModel,
});
