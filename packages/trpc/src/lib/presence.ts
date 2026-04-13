// NOTE: Presence is tracked in-memory. In a multi-instance deployment,
// move this to Redis (or another shared store) so that a heartbeat sent
// to one server instance is visible to clients served by another.

const lastSeen = new Map<string, number>();

const DEFAULT_ONLINE_THRESHOLD_MS = 60_000;
const EVICTION_AGE_MS = 10 * 60_000;

export function touch(userId: string): void {
  lastSeen.set(userId, Date.now());
}

export function isOnline(userId: string, thresholdMs = DEFAULT_ONLINE_THRESHOLD_MS): boolean {
  const ts = lastSeen.get(userId);
  if (ts === undefined) return false;
  return Date.now() - ts < thresholdMs;
}

export function getOnlineSet(userIds: string[], thresholdMs = DEFAULT_ONLINE_THRESHOLD_MS): Set<string> {
  const now = Date.now();
  const online = new Set<string>();
  for (const id of userIds) {
    const ts = lastSeen.get(id);
    if (ts !== undefined && now - ts < thresholdMs) online.add(id);
  }
  return online;
}

setInterval(() => {
  const cutoff = Date.now() - EVICTION_AGE_MS;
  for (const [id, ts] of lastSeen) {
    if (ts < cutoff) lastSeen.delete(id);
  }
}, 5 * 60_000);
