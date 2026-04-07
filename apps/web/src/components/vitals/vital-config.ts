export type VitalType =
  | "blood_pressure"
  | "heart_rate"
  | "weight"
  | "blood_glucose"
  | "temperature"
  | "oxygen_saturation";

export interface VitalConfig {
  type: VitalType;
  unit: string;
  color: string;
  normalRange: { min: number; max: number };
  hasSecondary?: boolean;
  secondaryLabel?: string;
  secondaryNormalRange?: { min: number; max: number };
}

export const VITAL_CONFIGS: VitalConfig[] = [
  {
    type: "blood_pressure",
    unit: "mmHg",
    color: "#dc2626",
    normalRange: { min: 90, max: 140 },
    hasSecondary: true,
    secondaryLabel: "diastolic",
    secondaryNormalRange: { min: 60, max: 90 },
  },
  {
    type: "heart_rate",
    unit: "bpm",
    color: "#e11d48",
    normalRange: { min: 50, max: 100 },
  },
  {
    type: "weight",
    unit: "kg",
    color: "#2563eb",
    normalRange: { min: 0, max: 999 },
  },
  {
    type: "blood_glucose",
    unit: "mg/dL",
    color: "#9333ea",
    normalRange: { min: 70, max: 180 },
  },
  {
    type: "temperature",
    unit: "°C",
    color: "#ea580c",
    normalRange: { min: 35, max: 38.5 },
  },
  {
    type: "oxygen_saturation",
    unit: "%",
    color: "#0891b2",
    normalRange: { min: 94, max: 100 },
  },
];

export const VITAL_MAP = Object.fromEntries(
  VITAL_CONFIGS.map((c) => [c.type, c])
) as Record<VitalType, VitalConfig>;

export function getAlertStatus(
  type: VitalType,
  primary: number,
  secondary?: number | null
): "normal" | "warning" | "danger" {
  const cfg = VITAL_MAP[type];
  if (!cfg) return "normal";

  if (primary > cfg.normalRange.max || primary < cfg.normalRange.min) {
    return "danger";
  }
  if (secondary != null && cfg.secondaryNormalRange) {
    if (secondary > cfg.secondaryNormalRange.max || secondary < cfg.secondaryNormalRange.min) {
      return "danger";
    }
  }

  // Warning zone: within 10% of threshold
  const margin = (cfg.normalRange.max - cfg.normalRange.min) * 0.1;
  if (
    primary > cfg.normalRange.max - margin ||
    primary < cfg.normalRange.min + margin
  ) {
    return "warning";
  }

  return "normal";
}
