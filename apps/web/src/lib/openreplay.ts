export function initOpenReplay() {
  const projectKey = import.meta.env.VITE_OPENREPLAY_PROJECT_KEY;
  const ingestPoint = import.meta.env.VITE_OPENREPLAY_INGEST_POINT;

  if (!projectKey || import.meta.env.DEV) return;

  void (async () => {
    const Tracker = (await import("@openreplay/tracker")).default;
    const tracker = new Tracker({
      projectKey,
      ingestPoint,
      __DISABLE_SECURE_MODE: false,
    });
    tracker.start();
  })();
}
