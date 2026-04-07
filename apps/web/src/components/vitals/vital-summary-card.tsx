import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { VITAL_MAP, getAlertStatus, type VitalType } from "./vital-config";

interface Props {
  type: VitalType;
  valuePrimary: number | null;
  valueSecondary?: number | null;
  measuredAt?: string | null;
  selected?: boolean;
  onClick?: () => void;
}

export function VitalSummaryCard({ type, valuePrimary, valueSecondary, measuredAt, selected, onClick }: Props) {
  const { t } = useTranslation("vitals");
  const cfg = VITAL_MAP[type];
  if (!cfg) return null;

  const status = valuePrimary != null ? getAlertStatus(type, valuePrimary, valueSecondary) : "normal";
  const statusColors = {
    normal: "border-green-200 dark:border-green-800",
    warning: "border-yellow-300 dark:border-yellow-700",
    danger: "border-red-300 dark:border-red-700",
  };

  const formattedValue =
    valuePrimary != null
      ? type === "blood_pressure" && valueSecondary != null
        ? `${Math.round(valuePrimary)}/${Math.round(valueSecondary)}`
        : type === "temperature"
          ? valuePrimary.toFixed(1)
          : Math.round(valuePrimary).toString()
      : "—";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 rounded-lg border-2 p-3 text-left transition-colors hover:bg-muted/50",
        statusColors[status],
        selected && "ring-2 ring-primary bg-muted/30"
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{t(`types.${type}`)}</span>
      <span className="text-xl font-bold" style={{ color: cfg.color }}>
        {formattedValue}
      </span>
      <span className="text-[10px] text-muted-foreground">{cfg.unit}</span>
      {measuredAt && (
        <span className="text-[10px] text-muted-foreground">
          {new Date(measuredAt).toLocaleDateString()}
        </span>
      )}
      {status !== "normal" && valuePrimary != null && (
        <span className={cn(
          "text-[10px] font-medium mt-0.5",
          status === "danger" ? "text-red-600" : "text-yellow-600"
        )}>
          {t(`alert.${status}`)}
        </span>
      )}
    </button>
  );
}
