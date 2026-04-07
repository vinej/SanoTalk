import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { VITAL_MAP, getAlertStatus, type VitalType } from "./vital-config";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../ui/scroll-area";

interface VitalRecord {
  id: string;
  type: string;
  valuePrimary: number;
  valueSecondary?: number | null;
  unit: string;
  notes?: string | null;
  measuredAt: string | Date;
}

interface Props {
  data: VitalRecord[];
  selectedType?: VitalType;
}

export function VitalHistoryTable({ data, selectedType }: Props) {
  const { t } = useTranslation("vitals");
  const utils = trpc.useUtils();
  const deleteMutation = trpc.vitals.delete.useMutation({
    onSuccess: () => {
      void utils.vitals.list.invalidate();
      void utils.vitals.latest.invalidate();
    },
  });

  const filtered = selectedType ? data.filter((d) => d.type === selectedType) : data;

  if (filtered.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        {t("noHistory")}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-xs">
            <th className="text-left py-2 px-2 font-medium">{t("date")}</th>
            {!selectedType && <th className="text-left py-2 px-2 font-medium">{t("vitalType")}</th>}
            <th className="text-right py-2 px-2 font-medium">{t("value")}</th>
            <th className="text-left py-2 px-2 font-medium">{t("notes")}</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => {
            const cfg = VITAL_MAP[row.type as VitalType];
            const status = getAlertStatus(row.type as VitalType, row.valuePrimary, row.valueSecondary);
            const formatted = row.type === "blood_pressure" && row.valueSecondary != null
              ? `${Math.round(row.valuePrimary)}/${Math.round(row.valueSecondary)}`
              : row.type === "temperature"
                ? row.valuePrimary.toFixed(1)
                : Math.round(row.valuePrimary).toString();

            return (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2 px-2 text-xs">
                  {new Date(row.measuredAt).toLocaleString(undefined, {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </td>
                {!selectedType && (
                  <td className="py-2 px-2">
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{ color: cfg?.color, backgroundColor: `${cfg?.color}15` }}
                    >
                      {t(`types.${row.type}`)}
                    </span>
                  </td>
                )}
                <td className={cn(
                  "py-2 px-2 text-right font-mono font-medium",
                  status === "danger" && "text-red-600",
                  status === "warning" && "text-yellow-600",
                )}>
                  {formatted} <span className="text-muted-foreground font-normal">{row.unit}</span>
                </td>
                <td className="py-2 px-2 text-xs text-muted-foreground max-w-[150px] truncate">
                  {row.notes || "—"}
                </td>
                <td className="py-2 px-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate({ id: row.id })}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}
