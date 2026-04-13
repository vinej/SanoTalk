import { logger } from "../logger";

// What we insert into vital_sign — kept loose-typed because the Drizzle insert
// shape is an inferred type.
export interface MappedVital {
  userId: string;
  type: "blood_pressure" | "heart_rate" | "weight" | "blood_glucose" | "temperature" | "oxygen_saturation";
  valuePrimary: number;
  valueSecondary: number | null;
  unit: string;
  source: string;
  externalId: string;
  measuredAt: Date;
  notes: string | null;
}

interface TerraSampleBase {
  timestamp?: string;
  start_time?: string;
  end_time?: string;
}

interface BodyPayload {
  user?: { provider?: string };
  data?: Array<{
    metadata?: { start_time?: string; end_time?: string };
    heart_data?: {
      heart_rate_data?: {
        summary?: { resting_hr_bpm?: number; avg_hr_bpm?: number };
        detailed?: { hr_samples?: Array<TerraSampleBase & { bpm?: number }> };
      };
      blood_pressure_data?: {
        blood_pressure_samples?: Array<TerraSampleBase & {
          systolic_bp?: number; diastolic_bp?: number;
        }>;
      };
    };
    measurements_data?: {
      measurements?: Array<TerraSampleBase & {
        measurement_time?: string;
        weight_kg?: number;
        BMI?: number;
      }>;
    };
    temperature_data?: {
      body_temperature_samples?: Array<TerraSampleBase & { temperature_celsius?: number }>;
    };
    oxygen_data?: {
      saturation_samples?: Array<TerraSampleBase & { percentage?: number }>;
    };
    glucose_data?: {
      blood_glucose_samples?: Array<TerraSampleBase & { blood_glucose_mg_per_dL?: number }>;
    };
  }>;
}

interface DailyPayload {
  user?: { provider?: string };
  data?: Array<{
    metadata?: { start_time?: string; end_time?: string };
    heart_rate_data?: {
      summary?: { resting_hr_bpm?: number; avg_hr_bpm?: number };
    };
    oxygenation_data?: {
      avg_saturation_percentage?: number;
    };
  }>;
}

function safeDate(input: string | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

function makeId(parts: Array<string | number | null | undefined>): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== "").join(":");
}

/**
 * Map a Terra body/daily payload to vitalSign rows. Out-of-range or
 * malformed samples are dropped with a warning rather than throwing — one bad
 * sample shouldn't fail the whole batch.
 */
export function mapTerraBodyPayload(payload: BodyPayload, userId: string): MappedVital[] {
  const provider = (payload.user?.provider ?? "unknown").toLowerCase();
  const source = `terra:${provider}`;
  const out: MappedVital[] = [];

  for (const entry of payload.data ?? []) {
    const entryStart = entry.metadata?.start_time;

    // Heart rate samples
    const hrSamples = entry.heart_data?.heart_rate_data?.detailed?.hr_samples ?? [];
    for (const s of hrSamples) {
      const ts = safeDate(s.timestamp ?? entryStart);
      const bpm = s.bpm;
      if (!ts || bpm === undefined) continue;
      if (!inRange(bpm, 20, 250)) { logger.debug({ bpm, source }, "drop hr out of range"); continue; }
      out.push({
        userId, source, type: "heart_rate",
        valuePrimary: bpm, valueSecondary: null, unit: "bpm",
        externalId: makeId([source, "hr", ts.toISOString()]),
        measuredAt: ts, notes: null,
      });
    }

    // Resting HR (summary fallback)
    const restingHr = entry.heart_data?.heart_rate_data?.summary?.resting_hr_bpm;
    if (restingHr !== undefined && entryStart) {
      const ts = safeDate(entryStart);
      if (ts && inRange(restingHr, 20, 250)) {
        out.push({
          userId, source, type: "heart_rate",
          valuePrimary: restingHr, valueSecondary: null, unit: "bpm",
          externalId: makeId([source, "rhr", ts.toISOString()]),
          measuredAt: ts, notes: "resting",
        });
      }
    }

    // Blood pressure
    const bpSamples = entry.heart_data?.blood_pressure_data?.blood_pressure_samples ?? [];
    for (const s of bpSamples) {
      const ts = safeDate(s.timestamp ?? entryStart);
      const sys = s.systolic_bp;
      const dia = s.diastolic_bp;
      if (!ts || sys === undefined || dia === undefined) continue;
      if (!inRange(sys, 50, 300) || !inRange(dia, 30, 200)) { logger.debug({ sys, dia, source }, "drop bp out of range"); continue; }
      out.push({
        userId, source, type: "blood_pressure",
        valuePrimary: sys, valueSecondary: dia, unit: "mmHg",
        externalId: makeId([source, "bp", ts.toISOString()]),
        measuredAt: ts, notes: null,
      });
    }

    // Weight
    const measurements = entry.measurements_data?.measurements ?? [];
    for (const m of measurements) {
      const ts = safeDate(m.measurement_time ?? m.timestamp ?? entryStart);
      const kg = m.weight_kg;
      if (!ts || kg === undefined) continue;
      if (!inRange(kg, 1, 500)) { logger.debug({ kg, source }, "drop weight out of range"); continue; }
      out.push({
        userId, source, type: "weight",
        valuePrimary: kg, valueSecondary: null, unit: "kg",
        externalId: makeId([source, "wt", ts.toISOString()]),
        measuredAt: ts, notes: null,
      });
    }

    // Temperature
    const tempSamples = entry.temperature_data?.body_temperature_samples ?? [];
    for (const s of tempSamples) {
      const ts = safeDate(s.timestamp ?? entryStart);
      const c = s.temperature_celsius;
      if (!ts || c === undefined) continue;
      if (!inRange(c, 25, 45)) { logger.debug({ c, source }, "drop temp out of range"); continue; }
      out.push({
        userId, source, type: "temperature",
        valuePrimary: c, valueSecondary: null, unit: "C",
        externalId: makeId([source, "tp", ts.toISOString()]),
        measuredAt: ts, notes: null,
      });
    }

    // SpO2
    const spo2Samples = entry.oxygen_data?.saturation_samples ?? [];
    for (const s of spo2Samples) {
      const ts = safeDate(s.timestamp ?? entryStart);
      const pct = s.percentage;
      if (!ts || pct === undefined) continue;
      if (!inRange(pct, 50, 100)) { logger.debug({ pct, source }, "drop spo2 out of range"); continue; }
      out.push({
        userId, source, type: "oxygen_saturation",
        valuePrimary: pct, valueSecondary: null, unit: "%",
        externalId: makeId([source, "o2", ts.toISOString()]),
        measuredAt: ts, notes: null,
      });
    }

    // Glucose
    const glucoseSamples = entry.glucose_data?.blood_glucose_samples ?? [];
    for (const s of glucoseSamples) {
      const ts = safeDate(s.timestamp ?? entryStart);
      const mg = s.blood_glucose_mg_per_dL;
      if (!ts || mg === undefined) continue;
      if (!inRange(mg, 10, 1000)) { logger.debug({ mg, source }, "drop glucose out of range"); continue; }
      out.push({
        userId, source, type: "blood_glucose",
        valuePrimary: mg, valueSecondary: null, unit: "mg/dL",
        externalId: makeId([source, "gl", ts.toISOString()]),
        measuredAt: ts, notes: null,
      });
    }
  }

  return out;
}

export function mapTerraDailyPayload(payload: DailyPayload, userId: string): MappedVital[] {
  const provider = (payload.user?.provider ?? "unknown").toLowerCase();
  const source = `terra:${provider}`;
  const out: MappedVital[] = [];

  for (const entry of payload.data ?? []) {
    const entryStart = entry.metadata?.start_time;
    const ts = safeDate(entryStart);
    if (!ts) continue;

    const restingHr = entry.heart_rate_data?.summary?.resting_hr_bpm;
    if (restingHr !== undefined && inRange(restingHr, 20, 250)) {
      out.push({
        userId, source, type: "heart_rate",
        valuePrimary: restingHr, valueSecondary: null, unit: "bpm",
        externalId: makeId([source, "rhr", ts.toISOString()]),
        measuredAt: ts, notes: "resting",
      });
    }

    const spo2 = entry.oxygenation_data?.avg_saturation_percentage;
    if (spo2 !== undefined && inRange(spo2, 50, 100)) {
      out.push({
        userId, source, type: "oxygen_saturation",
        valuePrimary: spo2, valueSecondary: null, unit: "%",
        externalId: makeId([source, "o2avg", ts.toISOString()]),
        measuredAt: ts, notes: null,
      });
    }
  }

  return out;
}

/**
 * Dispatch by Terra resource type. Used by both the webhook and the poll.
 */
export function mapTerraPayload(type: string, payload: unknown, userId: string): MappedVital[] {
  switch (type) {
    case "body":     return mapTerraBodyPayload(payload as BodyPayload, userId);
    case "daily":    return mapTerraDailyPayload(payload as DailyPayload, userId);
    case "activity": return mapTerraBodyPayload(payload as BodyPayload, userId); // activity carries hr_samples too
    default:         return [];
  }
}
