import { useEffect } from "react";
import { trpc } from "../lib/trpc";

const INTERVAL_MS = 30_000;

export function useHeartbeat() {
  const heartbeat = trpc.user.heartbeat.useMutation();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const fire = () => {
      if (document.visibilityState === "visible") {
        heartbeat.mutate();
      }
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
