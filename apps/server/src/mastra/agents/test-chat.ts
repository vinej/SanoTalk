import { Agent } from "@mastra/core/agent";
import { largeModel } from "../model.js";

export const testChatAgent = new Agent({
  id: "testChatAgent",
  name: "testChatAgent",
  instructions: "",
  model: largeModel,
});
