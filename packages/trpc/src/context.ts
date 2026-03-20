import type { inferAsyncReturnType } from "@trpc/server";
import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";
import { db } from "@sanotalk/db";
import { auth } from "./auth.js";

export async function createTRPCContext(opts: CreateHTTPContextOptions) {
  const session = await auth.api.getSession({
    headers: opts.req.headers as unknown as Headers,
  });

  return {
    db,
    session,
    user: session?.user ?? null,
    req: opts.req,
    res: opts.res,
  };
}

export type TRPCContext = inferAsyncReturnType<typeof createTRPCContext>;
