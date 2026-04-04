/**
 * Check if a URL is an external URL (DiceBear, etc.) vs a MinIO key.
 */
export function isExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

/**
 * Get initials from a name for avatar fallback.
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Resolve a user's avatar to a displayable URL.
 * External URLs (DiceBear, etc.) are returned as-is.
 * MinIO keys are resolved via the server-side avatar proxy (/api/avatar/:userId).
 * The imageKey is appended as a query param for cache busting on re-upload.
 */
export function useAvatarUrl(userId: string | undefined, imageKey: string | null | undefined) {
  if (!imageKey || !userId) return null;
  if (isExternalUrl(imageKey)) return imageKey;
  return `/api/avatar/${userId}?v=${encodeURIComponent(imageKey)}`;
}
