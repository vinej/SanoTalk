import { createTRPCRouter, publicProcedure } from "../trcp";

export const systemRouter = createTRPCRouter({
  aiInfo: publicProcedure.query(() => ({
    provider: process.env.AI_PROVIDER ?? "anthropic",
    model: process.env.AI_MODEL_LARGE ?? null,
  })),
});
