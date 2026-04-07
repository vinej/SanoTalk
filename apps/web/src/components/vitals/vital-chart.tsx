import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { VITAL_MAP, type VitalType } from "./vital-config";

interface VitalRecord {
  id: string;
  valuePrimary: number;
  valueSecondary?: number | null;
  measuredAt: string | Date;
}

interface Props {
  type: VitalType;
  data: VitalRecord[];
}

export function VitalChart({ type, data }: Props) {
  const { t } = useTranslation("vitals");
  const cfg = VITAL_MAP[type];

  const chartData = useMemo(
    () =>
      [...data]
        .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
        .map((d) => ({
          date: new Date(d.measuredAt).getTime(),
          label: new Date(d.measuredAt).toLocaleDateString(),
          primary: d.valuePrimary,
          secondary: d.valueSecondary ?? undefined,
        })),
    [data]
  );

  if (!cfg || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {t("noData")}
      </div>
    );
  }

  const allValues = chartData.flatMap((d) =>
    d.secondary != null ? [d.primary, d.secondary] : [d.primary]
  );
  const dataMin = Math.min(...allValues, cfg.normalRange.min);
  const dataMax = Math.max(...allValues, cfg.normalRange.max);
  const padding = (dataMax - dataMin) * 0.15 || 5;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[Math.floor(dataMin - padding), Math.ceil(dataMax + padding)]}
          tick={{ fontSize: 11 }}
          width={45}
        />
        <Tooltip
          labelFormatter={(_, payload) => {
            if (payload?.[0]?.payload?.label) return payload[0].payload.label;
            return "";
          }}
          formatter={(value: any, name: any) => [
            type === "temperature" ? Number(value).toFixed(1) : Math.round(Number(value)),
            name === "secondary" && cfg.secondaryLabel
              ? t(`labels.${cfg.secondaryLabel}`)
              : t(`types.${type}`),
          ] as any}
        />

        {/* Normal range band */}
        <ReferenceArea
          y1={cfg.normalRange.min}
          y2={cfg.normalRange.max}
          fill={cfg.color}
          fillOpacity={0.06}
          strokeOpacity={0}
        />

        {/* Threshold lines */}
        <ReferenceLine
          y={cfg.normalRange.max}
          stroke={cfg.color}
          strokeDasharray="4 4"
          strokeOpacity={0.5}
        />
        <ReferenceLine
          y={cfg.normalRange.min}
          stroke={cfg.color}
          strokeDasharray="4 4"
          strokeOpacity={0.5}
        />

        {/* Primary value line */}
        <Line
          type="monotone"
          dataKey="primary"
          stroke={cfg.color}
          strokeWidth={2}
          dot={{ r: 4, fill: cfg.color }}
          activeDot={{ r: 6 }}
          name="primary"
        />

        {/* Secondary line (diastolic for BP) */}
        {cfg.hasSecondary && (
          <Line
            type="monotone"
            dataKey="secondary"
            stroke={cfg.color}
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={{ r: 3, fill: cfg.color }}
            name="secondary"
            opacity={0.6}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
