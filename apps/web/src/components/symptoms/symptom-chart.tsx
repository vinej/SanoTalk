import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { SCORE_CATEGORIES, type ScoreKey } from "./symptom-config";

interface SymptomRecord {
  date: string;
  painLevel: number | null;
  mood: number | null;
  energy: number | null;
  sleepQuality: number | null;
  sleepHours: number | null;
  stress: number | null;
  appetite: number | null;
}

interface Props {
  data: SymptomRecord[];
}

export function SymptomChart({ data }: Props) {
  const { t } = useTranslation("symptoms");
  const [visible, setVisible] = useState<Set<ScoreKey>>(
    new Set(["painLevel", "mood", "energy", "sleepQuality", "stress", "appetite"])
  );
  const [showSleep, setShowSleep] = useState(false);

  const chartData = useMemo(
    () =>
      [...data]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((d) => ({
          date: d.date,
          label: new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          painLevel: d.painLevel,
          mood: d.mood,
          energy: d.energy,
          sleepQuality: d.sleepQuality,
          stress: d.stress,
          appetite: d.appetite,
          sleepHours: d.sleepHours,
        })),
    [data]
  );

  function toggle(key: ScoreKey) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {t("noEntries")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toggle buttons */}
      <div className="flex flex-wrap gap-1.5">
        {SCORE_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => toggle(cat.key)}
            className="px-2 py-0.5 text-xs rounded-full border transition-colors"
            style={{
              backgroundColor: visible.has(cat.key) ? cat.color + "20" : undefined,
              borderColor: visible.has(cat.key) ? cat.color : undefined,
              color: visible.has(cat.key) ? cat.color : undefined,
            }}
          >
            {t(cat.key)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowSleep(!showSleep)}
          className="px-2 py-0.5 text-xs rounded-full border transition-colors"
          style={{
            backgroundColor: showSleep ? "#06b6d420" : undefined,
            borderColor: showSleep ? "#06b6d4" : undefined,
            color: showSleep ? "#06b6d4" : undefined,
          }}
        >
          {t("sleepHours")}
        </button>
      </div>

      {/* Chart */}
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis yAxisId="score" domain={[0, 10]} tick={{ fontSize: 11 }} width={30} />
            {showSleep && (
              <YAxis yAxisId="sleep" orientation="right" domain={[0, 12]} tick={{ fontSize: 11 }} width={30} />
            )}
            <Tooltip
              formatter={(value: any, name: any) => {
                if (name === "sleepHours") return [value != null ? `${Number(value).toFixed(1)}h` : "—", t("sleepHours")];
                return [value != null ? `${value}/10` : "—", t(name as string)];
              }}
            />
            {SCORE_CATEGORIES.map((cat) =>
              visible.has(cat.key) ? (
                <Line
                  key={cat.key}
                  yAxisId="score"
                  type="monotone"
                  dataKey={cat.key}
                  stroke={cat.chartColor}
                  strokeWidth={2}
                  dot={{ r: 3, fill: cat.chartColor }}
                  connectNulls
                  name={cat.key}
                />
              ) : null
            )}
            {showSleep && (
              <Line
                yAxisId="sleep"
                type="monotone"
                dataKey="sleepHours"
                stroke="#06b6d4"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={{ r: 3, fill: "#06b6d4" }}
                connectNulls
                name="sleepHours"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
