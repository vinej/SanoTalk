import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import type { TRPCContext } from "./context";
import superjson from 'superjson';

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const isProd = process.env.NODE_ENV === "production";
    return {
      ...shape,
      data: {
        ...shape.data,
        stack: isProd ? undefined : shape.data.stack,
        zodError:
          !isProd && error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!(ctx.user as any).approved) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Account pending approval" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.user,
    },
  });
});
