import { createTRPCReact, type CreateTRPCReact } from "@trpc/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import type { AppRouterSonoTalk } from "@sanotalk/trpc";
import superjson from "superjson"

export const trpc: CreateTRPCReact<AppRouterSonoTalk, unknown> = createTRPCReact<AppRouterSonoTalk>();

export const trpcClient = trpc.createClient({
  links: [
    loggerLink({
      enabled: (opts) =>
        import.meta.env.DEV ||
        (opts.direction === "down" && opts.result instanceof Error),
    }),
    httpBatchLink({
      url: `${typeof window !== "undefined" ? window.location.origin : import.meta.env.VITE_API_URL}/api/trpc`,
      transformer : superjson,
      headers() {
        return {};
      },
      fetch(url, options) {
        return fetch(url, { ...options as any, credentials: "include" });
      },
    }),
  ],
});
