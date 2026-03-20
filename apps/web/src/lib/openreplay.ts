export function initOpenReplay() {
  const projectKey = process.env.VITE_OPENREPLAY_PROJECT_KEY
  const ingestPoint = process.env.VITE_OPENREPLAY_INGEST_POINT? process.env.VITE_OPENREPLAY_INGEST_POINT: undefined;

  if (!projectKey || process.env.DEV) return;

  return;

  /*
  void (async () => {
    const Tracker = (await import("@openreplay/tracker")).default;

    const tracker = new Tracker({
      projectKey,
      ingestPoint,
      __DISABLE_SECURE_MODE?: false,
    }
  );
    tracker.start();
  })();
  */
}
