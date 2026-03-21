import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import type { AppRouterSonoTalk } from "@sanotalk/trpc";

export const trpc = createTRPCReact<AppRouterSonoTalk>();

export const trpcClient = trpc.createClient({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === "development" ||
        (opts.direction === "down" && opts.result instanceof Error),
    }),
    httpBatchLink({
      url: 'http://localhost:3001/api/trpc',
      headers() {
        return {};
      },
      fetch(url, options) {
        return fetch(url, { ...options as any, credentials: "include" });
      },
    }),
  ],
});
