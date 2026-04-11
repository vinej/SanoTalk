export type ExerciseCategory = "tai_chi" | "stretching" | "balance" | "strength" | "cardio";
export type DifficultyLevel = "beginner" | "intermediate" | "advanced";

export interface Exercise {
  id: string;
  category: ExerciseCategory;
  difficulty: DifficultyLevel;
  durationMins: number;
  stepCount: number;
}

export const CATEGORIES: ExerciseCategory[] = [
  "tai_chi", "stretching", "balance", "strength", "cardio",
];

export const DIFFICULTIES: DifficultyLevel[] = [
  "beginner", "intermediate", "advanced",
];

export const CATEGORY_COLORS: Record<ExerciseCategory, { text: string; bg: string; border: string }> = {
  tai_chi:    { text: "text-emerald-700", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800" },
  stretching: { text: "text-sky-700",     bg: "bg-sky-50 dark:bg-sky-950/30",         border: "border-sky-200 dark:border-sky-800" },
  balance:    { text: "text-violet-700",  bg: "bg-violet-50 dark:bg-violet-950/30",   border: "border-violet-200 dark:border-violet-800" },
  strength:   { text: "text-orange-700",  bg: "bg-orange-50 dark:bg-orange-950/30",   border: "border-orange-200 dark:border-orange-800" },
  cardio:     { text: "text-rose-700",    bg: "bg-rose-50 dark:bg-rose-950/30",       border: "border-rose-200 dark:border-rose-800" },
};

export const DIFFICULTY_COLORS: Record<DifficultyLevel, string> = {
  beginner:     "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  intermediate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  advanced:     "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export const EXERCISES: Exercise[] = [
  // Tai Chi (Seated) — highlighted first
  { id: "tai_chi_cloud_hands",     category: "tai_chi",    difficulty: "beginner",     durationMins: 5,  stepCount: 6 },
  { id: "tai_chi_brush_knee",      category: "tai_chi",    difficulty: "beginner",     durationMins: 5,  stepCount: 6 },
  { id: "tai_chi_repulse_monkey",  category: "tai_chi",    difficulty: "intermediate", durationMins: 8,  stepCount: 7 },
  { id: "tai_chi_wave_hands",      category: "tai_chi",    difficulty: "intermediate", durationMins: 8,  stepCount: 6 },
  { id: "tai_chi_golden_rooster",  category: "tai_chi",    difficulty: "advanced",     durationMins: 10, stepCount: 7 },

  // Stretching
  { id: "stretch_neck_rolls",       category: "stretching", difficulty: "beginner",     durationMins: 3, stepCount: 5 },
  { id: "stretch_shoulder_shrugs",  category: "stretching", difficulty: "beginner",     durationMins: 3, stepCount: 5 },
  { id: "stretch_seated_hamstring", category: "stretching", difficulty: "intermediate", durationMins: 5, stepCount: 6 },
  { id: "stretch_ankle_circles",    category: "stretching", difficulty: "beginner",     durationMins: 3, stepCount: 5 },
  { id: "stretch_wrist_hands",      category: "stretching", difficulty: "intermediate", durationMins: 5, stepCount: 6 },

  // Balance
  { id: "balance_weight_shift",     category: "balance", difficulty: "beginner",     durationMins: 4, stepCount: 5 },
  { id: "balance_standing_march",   category: "balance", difficulty: "beginner",     durationMins: 5, stepCount: 5 },
  { id: "balance_single_leg",       category: "balance", difficulty: "intermediate", durationMins: 5, stepCount: 6 },
  { id: "balance_heel_toe_walk",    category: "balance", difficulty: "intermediate", durationMins: 5, stepCount: 6 },
  { id: "balance_tandem_stance",    category: "balance", difficulty: "advanced",     durationMins: 6, stepCount: 6 },

  // Strength
  { id: "strength_chair_squats",     category: "strength", difficulty: "beginner",     durationMins: 5, stepCount: 6 },
  { id: "strength_seated_leg_raise", category: "strength", difficulty: "beginner",     durationMins: 5, stepCount: 5 },
  { id: "strength_wall_pushups",     category: "strength", difficulty: "intermediate", durationMins: 5, stepCount: 6 },
  { id: "strength_arm_curls",        category: "strength", difficulty: "intermediate", durationMins: 5, stepCount: 6 },
  { id: "strength_calf_raises",      category: "strength", difficulty: "advanced",     durationMins: 6, stepCount: 6 },

  // Cardio
  { id: "cardio_seated_march",  category: "cardio", difficulty: "beginner",     durationMins: 5, stepCount: 5 },
  { id: "cardio_arm_circles",   category: "cardio", difficulty: "beginner",     durationMins: 4, stepCount: 5 },
  { id: "cardio_step_in_place", category: "cardio", difficulty: "intermediate", durationMins: 8, stepCount: 6 },
  { id: "cardio_seated_jacks",  category: "cardio", difficulty: "intermediate", durationMins: 6, stepCount: 6 },
  { id: "cardio_side_steps",    category: "cardio", difficulty: "advanced",     durationMins: 8, stepCount: 6 },
];
