import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  Line,
} from "recharts";
import { trpc } from "../../lib/trpc";
import { Loader2 } from "lucide-react";

interface Props {
  facilityName: string;
  range: "24h" | "7d" | "30d";
}

export function ErHistoryChart({ facilityName, range }: Props) {
  const { t } = useTranslation("healthHelp");
  const { data = [], isLoading } = trpc.healthHelp.facilityHistory.useQuery(
    { facilityName, range },
    { enabled: !!facilityName }
  );

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        time: new Date(d.snapshotAt).getTime(),
        label: new Date(d.snapshotAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        occupancy: d.occupancyRate,
        waiting: d.patientsWaiting,
        avgWait: d.avgWaitHours,
      })),
    [data]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[280px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
        {t("noHistoryData")}
      </div>
    );
  }

  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis domain={[0, "auto"]} tick={{ fontSize: 11 }} width={40} unit="%" />

          {/* Color bands */}
          <ReferenceArea y1={0} y2={80} fill="#22c55e" fillOpacity={0.05} strokeOpacity={0} />
          <ReferenceArea y1={80} y2={120} fill="#eab308" fillOpacity={0.05} strokeOpacity={0} />
          <ReferenceArea y1={120} y2={300} fill="#ef4444" fillOpacity={0.05} strokeOpacity={0} />

          <Tooltip
            formatter={(value: any, name: any) => {
              if (name === "occupancy") return [`${value}%`, t("occupancyRate")];
              if (name === "waiting") return [value, t("patientsWaiting")];
              return [value, name];
            }}
          />

          <Area
            type="monotone"
            dataKey="occupancy"
            stroke="#2563eb"
            fill="#2563eb"
            fillOpacity={0.15}
            strokeWidth={2}
            dot={false}
            connectNulls
            name="occupancy"
          />
          <Line
            type="monotone"
            dataKey="waiting"
            stroke="#f97316"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            connectNulls
            name="waiting"
            yAxisId={0}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
