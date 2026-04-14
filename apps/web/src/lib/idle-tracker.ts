/** Inactivity threshold after which the user is considered idle and signed
 *  out. Mirrored by the server's session.expiresIn in
 *  packages/trpc/src/auth.ts — keep these in sync. */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/** Throttle for activity events: never bump the timestamp more than once per
 *  this many ms. Avoids storming localStorage on mousemove. */
const ACTIVITY_WRITE_THROTTLE_MS = 5_000;

const STORAGE_KEY = "sanotalk:lastActivity";

let lastActivityAt = Date.now();
let lastWriteAt = 0;

function readStored(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v ? Number(v) || 0 : 0;
  } catch {
    return 0;
  }
}

/** Latest activity across all tabs in this browser. */
export function getLastActivity(): number {
  return Math.max(lastActivityAt, readStored());
}

export function markActivity(): void {
  const now = Date.now();
  lastActivityAt = now;
  if (now - lastWriteAt >= ACTIVITY_WRITE_THROTTLE_MS) {
    lastWriteAt = now;
    try { localStorage.setItem(STORAGE_KEY, String(now)); } catch { /* quota — ignore */ }
  }
}

/** Wire activity events on the document. Returns a cleanup function. */
export function installActivityListeners(): () => void {
  const events: (keyof DocumentEventMap)[] = [
    "mousedown",
    "mousemove",
    "keydown",
    "scroll",
    "touchstart",
    "pointerdown",
    "wheel",
  ];
  const handler = () => markActivity();
  for (const ev of events) {
    document.addEventListener(ev, handler, { passive: true });
  }
  // Other tabs writing activity should also count here.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      const ts = Number(e.newValue);
      if (ts > lastActivityAt) lastActivityAt = ts;
    }
  };
  window.addEventListener("storage", onStorage);
  // Seed the timestamp so a freshly mounted hook doesn't see "idle from epoch".
  markActivity();
  return () => {
    for (const ev of events) document.removeEventListener(ev, handler);
    window.removeEventListener("storage", onStorage);
  };
}

export function clearStoredActivity(): void {
  lastActivityAt = 0;
  lastWriteAt = 0;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
