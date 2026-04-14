import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { signOut } from "../lib/auth-client";
import { queryClient } from "../lib/query-client";
import { tracker } from "../lib/tracker";
import {
  IDLE_TIMEOUT_MS,
  clearStoredActivity,
  getLastActivity,
  installActivityListeners,
} from "../lib/idle-tracker";

/** How often we check whether the idle threshold has been crossed. */
const CHECK_INTERVAL_MS = 30_000;

/** Tracks real user input and signs the user out after IDLE_TIMEOUT_MS of
 *  inactivity. Heartbeat is paused independently when idle (see
 *  use-heartbeat.ts) so it cannot keep the server-side session alive. */
export function useIdleTimeout() {
  const navigate = useNavigate();
  const firedRef = useRef(false);

  useEffect(() => {
    const removeListeners = installActivityListeners();

    const check = async () => {
      if (firedRef.current) return;
      const idleFor = Date.now() - getLastActivity();
      if (idleFor < IDLE_TIMEOUT_MS) return;
      firedRef.current = true;
      try {
        if (tracker) tracker.stop();
      } catch { /* ignore */ }
      try { queryClient.clear(); } catch { /* ignore */ }
      try { sessionStorage.clear(); } catch { /* ignore */ }
      clearStoredActivity();
      try { await signOut(); } catch { /* ignore — server may already have expired the session */ }
      navigate({ to: "/login", search: { reason: "idle" } as Record<string, unknown> } as never);
    };

    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      removeListeners();
    };
  }, [navigate]);
}
