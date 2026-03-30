import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";
import { db } from "@sanotalk/db";
import { auth } from "./auth";

export type UserProperty = { key: string; value: string };

interface ContextExtras {
  triggerAgentRun?: (runId: string) => void;
  callHealthChat?: (
    history: Array<{ role: "user" | "assistant"; content: string }>,
    userMessage: string,
    language?: string,
    userProperties?: UserProperty[],
    propertiesLanguage?: string
  ) => Promise<string>;
  callCompanionChat?: (
    history: Array<{ role: "user" | "assistant"; content: string }>,
    userMessage: string,
    language?: string,
    userProperties?: UserProperty[],
    propertiesLanguage?: string
  ) => Promise<string>;
  callNewsChat?: (
    history: Array<{ role: "user" | "assistant"; content: string }>,
    userMessage: string,
    language?: string,
    userProperties?: UserProperty[],
    propertiesLanguage?: string
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
    callCompanionChat: extras.callCompanionChat ?? (async () => ""),
    callNewsChat: extras.callNewsChat ?? (async () => ""),
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>
