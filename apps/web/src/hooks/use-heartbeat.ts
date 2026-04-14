import { useEffect } from "react";
import { trpc } from "../lib/trpc";
import { getLastActivity, IDLE_TIMEOUT_MS } from "../lib/idle-tracker";

const INTERVAL_MS = 30_000;

export function useHeartbeat() {
  const heartbeat = trpc.user.heartbeat.useMutation();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const fire = () => {
      // Skip when the tab is hidden OR the user has been idle past the
      // session-timeout threshold. The latter prevents heartbeat from
      // refreshing the better-auth session for an inactive user — the
      // idle-timeout hook owns the real sign-out path.
      if (document.visibilityState !== "visible") return;
      if (Date.now() - getLastActivity() >= IDLE_TIMEOUT_MS) return;
      heartbeat.mutate();
    };

    const start = () => {
      if (timer !== null) return;
      fire();
      timer = setInterval(fire, INTERVAL_MS);
    };

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // heartbeat.mutate is stable across renders; depending on it would retrigger the effect needlessly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
