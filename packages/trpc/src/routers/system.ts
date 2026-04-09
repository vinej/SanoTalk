import { createTRPCRouter, protectedProcedure } from "../trcp";

export const systemRouter = createTRPCRouter({
  aiInfo: protectedProcedure.query(() => ({
    provider: process.env.AI_PROVIDER ?? "anthropic",
    model: process.env.AI_MODEL_LARGE ?? null,
  })),
});
