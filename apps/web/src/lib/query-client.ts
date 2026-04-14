import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";

let redirecting = false;

function isUnauthorized(err: unknown): boolean {
  const e = err as { data?: { code?: string }; shape?: { data?: { code?: string } } } | null;
  return e?.data?.code === "UNAUTHORIZED" || e?.shape?.data?.code === "UNAUTHORIZED";
}

/** Centralized handler for "session is gone" — cancels in-flight queries and
 *  bounces to /login. Without this, a polled query (e.g. listFriends every
 *  30 s) keeps firing UNAUTHORIZED long after the cookie is dead. */
function handleAuthExpired() {
  if (redirecting) return;
  redirecting = true;
  try { queryClient.cancelQueries(); } catch { /* ignore */ }
  try { queryClient.clear(); } catch { /* ignore */ }
  // Don't redirect if we're already on a public auth page — avoids loops.
  const path = window.location.pathname;
  if (path.startsWith("/login") || path.startsWith("/signup") || path.startsWith("/verify-email")) {
    return;
  }
  // Full navigation simplifies state cleanup; query/router state is rebuilt
  // from scratch on the login page.
  window.location.replace("/login?reason=expired");
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => { if (isUnauthorized(err)) handleAuthExpired(); },
  }),
  mutationCache: new MutationCache({
    onError: (err) => { if (isUnauthorized(err)) handleAuthExpired(); },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
      // Never retry auth failures — handleAuthExpired will redirect anyway.
      retry: (failureCount, err) => {
        if (isUnauthorized(err)) return false;
        const code = (err as { data?: { code?: string } } | null)?.data?.code;
        if (code === "FORBIDDEN" || code === "BAD_REQUEST" || code === "NOT_FOUND") return false;
        return failureCount < 1;
      },
    },
    mutations: {
      retry: 0,
    },
  },
});
