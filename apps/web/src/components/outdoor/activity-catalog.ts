export type OutdoorCategory = "walking" | "fast_walking" | "running" | "cycling" | "swimming" | "hiking" | "gardening" | "other";
export type IntensityLevel = "light" | "moderate" | "vigorous";

export interface OutdoorActivity {
  id: string;
  category: OutdoorCategory;
  intensity: IntensityLevel;
  suggestedMins: number;
  tipCount: number;
}

export const CATEGORIES: OutdoorCategory[] = [
  "walking", "fast_walking", "running", "cycling", "swimming", "hiking", "gardening", "other",
];

export const INTENSITIES: IntensityLevel[] = [
  "light", "moderate", "vigorous",
];

export const CATEGORY_COLORS: Record<OutdoorCategory, { text: string; bg: string; border: string }> = {
  walking:      { text: "text-green-700",  bg: "bg-green-50 dark:bg-green-950/30",  border: "border-green-200 dark:border-green-800" },
  fast_walking: { text: "text-teal-700",   bg: "bg-teal-50 dark:bg-teal-950/30",    border: "border-teal-200 dark:border-teal-800" },
  running:      { text: "text-orange-700", bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800" },
  cycling:      { text: "text-blue-700",   bg: "bg-blue-50 dark:bg-blue-950/30",     border: "border-blue-200 dark:border-blue-800" },
  swimming:     { text: "text-cyan-700",   bg: "bg-cyan-50 dark:bg-cyan-950/30",     border: "border-cyan-200 dark:border-cyan-800" },
  hiking:       { text: "text-amber-700",  bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-200 dark:border-amber-800" },
  gardening:    { text: "text-lime-700",   bg: "bg-lime-50 dark:bg-lime-950/30",     border: "border-lime-200 dark:border-lime-800" },
  other:        { text: "text-violet-700", bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800" },
};

export const INTENSITY_COLORS: Record<IntensityLevel, string> = {
  light:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  moderate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  vigorous: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export const ACTIVITIES: OutdoorActivity[] = [
  // Walking
  { id: "walk_neighborhood",  category: "walking",      intensity: "light",    suggestedMins: 30, tipCount: 4 },
  { id: "walk_park",          category: "walking",      intensity: "moderate", suggestedMins: 30, tipCount: 4 },
  { id: "walk_nature_trail",  category: "walking",      intensity: "moderate", suggestedMins: 45, tipCount: 4 },

  // Fast Walking
  { id: "fast_walk_interval", category: "fast_walking", intensity: "moderate", suggestedMins: 20, tipCount: 4 },
  { id: "fast_walk_poles",    category: "fast_walking", intensity: "moderate", suggestedMins: 30, tipCount: 4 },
  { id: "nordic_walking",     category: "fast_walking", intensity: "vigorous", suggestedMins: 30, tipCount: 4 },

  // Running
  { id: "jog_easy",           category: "running",      intensity: "moderate", suggestedMins: 15, tipCount: 4 },
  { id: "jog_walk_intervals", category: "running",      intensity: "moderate", suggestedMins: 20, tipCount: 4 },

  // Cycling
  { id: "cycle_leisure",      category: "cycling",      intensity: "light",    suggestedMins: 30, tipCount: 4 },
  { id: "cycle_path",         category: "cycling",      intensity: "moderate", suggestedMins: 30, tipCount: 4 },
  { id: "cycle_hills",        category: "cycling",      intensity: "vigorous", suggestedMins: 20, tipCount: 4 },

  // Swimming
  { id: "swim_laps",          category: "swimming",     intensity: "moderate", suggestedMins: 20, tipCount: 4 },
  { id: "swim_aqua_walk",     category: "swimming",     intensity: "light",    suggestedMins: 30, tipCount: 4 },

  // Hiking
  { id: "hike_easy",          category: "hiking",       intensity: "moderate", suggestedMins: 45, tipCount: 4 },

  // Gardening
  { id: "garden_active",      category: "gardening",    intensity: "light",    suggestedMins: 30, tipCount: 4 },

  // Other
  { id: "outdoor_tai_chi",    category: "other",        intensity: "light",    suggestedMins: 20, tipCount: 4 },
];
