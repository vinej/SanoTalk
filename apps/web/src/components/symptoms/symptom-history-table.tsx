import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Trash2, Pencil, Loader2 } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { SCORE_CATEGORIES, getScoreColor } from "./symptom-config";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../ui/scroll-area";

interface SymptomRecord {
  id: string;
  date: string;
  painLevel: number | null;
  mood: number | null;
  energy: number | null;
  sleepQuality: number | null;
  sleepHours: number | null;
  stress: number | null;
  appetite: number | null;
  customSymptoms: string[] | null;
  bodyLocation: string | null;
  notes: string | null;
}

interface Props {
  data: SymptomRecord[];
  onEdit: (entry: SymptomRecord) => void;
}

export function SymptomHistoryTable({ data, onEdit }: Props) {
  const { t } = useTranslation("symptoms");
  const utils = trpc.useUtils();
  const deleteMutation = trpc.symptoms.delete.useMutation({
    onSuccess: () => {
      void utils.symptoms.list.invalidate();
    },
  });

  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        {t("noEntries")}
      </div>
    );
  }

  function renderScore(val: number | null, key: string) {
    const cat = SCORE_CATEGORIES.find((c) => c.key === key);
    if (val == null || !cat) return <span className="text-muted-foreground">—</span>;
    return (
      <span className={cn("font-mono font-medium", getScoreColor(val, cat.max, cat.inverted))}>
        {val}
      </span>
    );
  }

  return (
    <ScrollArea className="h-full">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-xs">
            <th className="text-left py-2 px-2 font-medium">{t("date")}</th>
            <th className="text-center py-2 px-1 font-medium">{t("painLevel")}</th>
            <th className="text-center py-2 px-1 font-medium">{t("mood")}</th>
            <th className="text-center py-2 px-1 font-medium">{t("energy")}</th>
            <th className="text-center py-2 px-1 font-medium">{t("sleepQuality")}</th>
            <th className="text-center py-2 px-1 font-medium">{t("sleepHours")}</th>
            <th className="text-center py-2 px-1 font-medium">{t("stress")}</th>
            <th className="text-center py-2 px-1 font-medium">{t("appetite")}</th>
            <th className="text-left py-2 px-2 font-medium">{t("customSymptoms")}</th>
            <th className="w-16"></th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-2 px-2 text-xs whitespace-nowrap">
                {new Date(row.date + "T00:00:00").toLocaleDateString(undefined, {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </td>
              <td className="py-2 px-1 text-center">{renderScore(row.painLevel, "painLevel")}</td>
              <td className="py-2 px-1 text-center">{renderScore(row.mood, "mood")}</td>
              <td className="py-2 px-1 text-center">{renderScore(row.energy, "energy")}</td>
              <td className="py-2 px-1 text-center">{renderScore(row.sleepQuality, "sleepQuality")}</td>
              <td className="py-2 px-1 text-center text-muted-foreground font-mono text-xs">
                {row.sleepHours != null ? `${row.sleepHours}h` : "—"}
              </td>
              <td className="py-2 px-1 text-center">{renderScore(row.stress, "stress")}</td>
              <td className="py-2 px-1 text-center">{renderScore(row.appetite, "appetite")}</td>
              <td className="py-2 px-2 max-w-[150px]">
                {row.customSymptoms && row.customSymptoms.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {row.customSymptoms.slice(0, 3).map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {s}
                      </Badge>
                    ))}
                    {row.customSymptoms.length > 3 && (
                      <span className="text-xs text-muted-foreground">+{row.customSymptoms.length - 3}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2 px-1 flex gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => onEdit(row)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
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
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}
