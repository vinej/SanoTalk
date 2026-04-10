import { createTRPCRouter, protectedProcedure } from "../trcp";
import { verifyAdminFromDb } from "../lib/verify-admin";

export const systemRouter = createTRPCRouter({
  aiInfo: protectedProcedure.query(async ({ ctx }) => {
    const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
    if (!isAdmin) {
      // Non-admin users only need to know AI is enabled, not the provider/model details
      return { provider: "ai", model: null };
    }
    return {
      provider: process.env.AI_PROVIDER ?? "anthropic",
      model: process.env.AI_MODEL_LARGE ?? null,
    };
  }),
  // Admin-only: reports whether the Test Agent has a model override set via
  // TEST_AGENT_PROVIDER / TEST_AGENT_MODEL. Returns null for non-admins or
  // when no override is configured (so the header hides the line).
  testAgentInfo: protectedProcedure.query(async ({ ctx }) => {
    const isAdmin = await verifyAdminFromDb(ctx.db, ctx.user.id);
    if (!isAdmin) return null;
    const provider = process.env.TEST_AGENT_PROVIDER ?? null;
    const model = process.env.TEST_AGENT_MODEL ?? null;
    if (!provider && !model) return null;
    return { provider, model };
  }),
});
