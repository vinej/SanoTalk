export const FREQUENCY_OPTIONS = [
  "once_daily",
  "twice_daily",
  "three_times_daily",
  "four_times_daily",
  "every_morning",
  "every_evening",
  "as_needed",
  "weekly",
] as const;

export type Frequency = (typeof FREQUENCY_OPTIONS)[number];

export const ROUTE_OPTIONS = [
  "oral",
  "sublingual",
  "topical",
  "injection",
  "inhalation",
  "rectal",
  "ophthalmic",
  "otic",
  "nasal",
] as const;

export type Route = (typeof ROUTE_OPTIONS)[number];
