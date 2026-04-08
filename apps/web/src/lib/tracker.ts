import Tracker from "@openreplay/tracker";

const enabled = import.meta.env.VITE_OPENREPLAY_ENABLED === "true";
const projectKey = import.meta.env.VITE_OPENREPLAY_PROJECT_KEY as string | undefined;
const ingestPoint = import.meta.env.VITE_OPENREPLAY_INGEST_POINT as string | undefined;

// Singleton — importable anywhere in the app.
// tracker.start() is called in main.tsx; tracker.setUserID() is called in _auth.tsx.
if (!enabled) console.log("[OpenReplay] disabled (VITE_OPENREPLAY_ENABLED != true)");

export const tracker = enabled && projectKey
  ? new Tracker({
      projectKey,
      ...(ingestPoint ? { ingestPoint } : {}),
      __DISABLE_SECURE_MODE: import.meta.env.DEV,
      obscureTextEmails: true,
      obscureInputNumbers: true,
      obscureTextNumbers: true,
      defaultInputMode: 1, // mask all inputs by default
      network: {
        capturePayload: false,
        sessionTokenHeader: false,
        failuresOnly: false,
        ignoreHeaders: true,
        captureInIframes: false,
      },
    })
  : null;
