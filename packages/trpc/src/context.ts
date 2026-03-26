import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";
import { db } from "@sanotalk/db";
import { auth } from "./auth";

interface ContextExtras {
  triggerAgentRun?: (runId: string) => void;
  callHealthChat?: (
    history: Array<{ role: "user" | "assistant"; content: string }>,
    userMessage: string,
    language?: string
  ) => Promise<string>;
}

export async function createTRPCContext(opts: CreateHTTPContextOptions, extras: ContextExtras = {}) {
  const session = await auth.api.getSession({
    headers: opts.req.headers as unknown as Headers,
  });

  return {
    db,
    session,
    user: session?.user ?? null,
    req: opts.req,
    res: opts.res,
    triggerAgentRun: extras.triggerAgentRun ?? (() => {}),
    callHealthChat: extras.callHealthChat ?? (async () => ""),
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>
