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
  joinAiParticipant?: (sessionId: string, aiUserId: string) => Promise<void>;
  removeAiParticipant?: (sessionId: string, aiUserId: string) => Promise<void>;
  removeAllAiParticipants?: (sessionId: string) => Promise<void>;
  isAiAssistant?: (userId: string) => Promise<boolean>;
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
    joinAiParticipant: extras.joinAiParticipant ?? (async () => {}),
    removeAiParticipant: extras.removeAiParticipant ?? (async () => {}),
    removeAllAiParticipants: extras.removeAllAiParticipants ?? (async () => {}),
    isAiAssistant: extras.isAiAssistant ?? (async () => false),
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>
