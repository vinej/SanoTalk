/** Escape user-controlled strings before interpolating into HTML email templates. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip control characters from user input before use in email subjects (prevents header injection). */
export function sanitizeSubject(str: string): string {
  return str.replace(/[\r\n\x00-\x1F\x7F]/g, "").slice(0, 200);
}
