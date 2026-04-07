export const SCORE_CATEGORIES = [
  { key: "painLevel", min: 0, max: 10, color: "#ef4444", chartColor: "#ef4444", inverted: true },
  { key: "mood", min: 1, max: 10, color: "#eab308", chartColor: "#eab308", inverted: false },
  { key: "energy", min: 1, max: 10, color: "#f97316", chartColor: "#f97316", inverted: false },
  { key: "sleepQuality", min: 1, max: 10, color: "#6366f1", chartColor: "#6366f1", inverted: false },
  { key: "stress", min: 1, max: 10, color: "#a855f7", chartColor: "#a855f7", inverted: true },
  { key: "appetite", min: 1, max: 10, color: "#22c55e", chartColor: "#22c55e", inverted: false },
] as const;

export type ScoreKey = (typeof SCORE_CATEGORIES)[number]["key"];

/**
 * Returns a Tailwind text color class based on score value.
 * For inverted categories (pain, stress): high = bad (red), low = good (green).
 * For normal categories: high = good (green), low = bad (red).
 */
export function getScoreColor(value: number, max: number, inverted: boolean): string {
  const ratio = value / max;
  const effective = inverted ? 1 - ratio : ratio;
  if (effective >= 0.7) return "text-green-600";
  if (effective >= 0.4) return "text-yellow-600";
  return "text-red-600";
}

export function getScoreBgColor(value: number, max: number, inverted: boolean): string {
  const ratio = value / max;
  const effective = inverted ? 1 - ratio : ratio;
  if (effective >= 0.7) return "bg-green-100 dark:bg-green-950/30";
  if (effective >= 0.4) return "bg-yellow-100 dark:bg-yellow-950/30";
  return "bg-red-100 dark:bg-red-950/30";
}
