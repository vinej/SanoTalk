import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { trpc } from "../../lib/trpc";
import { INTENSITY_COLORS } from "./activity-catalog";
import type { IntensityLevel } from "./activity-catalog";

export function OutdoorHistoryTable() {
  const { t } = useTranslation("goOutside");
  const utils = trpc.useUtils();
  const { data: logs } = trpc.outdoor.list.useQuery({ limit: 50 });

  const deleteMutation = trpc.outdoor.delete.useMutation({
    onSuccess: () => utils.outdoor.invalidate(),
  });

  if (!logs || logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        {t("progress.noActivities")}
      </p>
    );
  }

  function getActivityName(activityId: string): string {
    if (activityId.startsWith("custom:")) {
      return activityId; // route page can resolve custom names
    }
    return t(`activities.${activityId}.name`);
  }

  return (
    <div>
      <h3 className="text-sm font-medium mb-2">{t("progress.history")}</h3>
      <div className="rounded-md border overflow-auto max-h-[300px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">{t("activity.logActivity")}</TableHead>
              <TableHead className="text-xs">{t("categories.all")}</TableHead>
              <TableHead className="text-xs">{t("log.duration")}</TableHead>
              <TableHead className="text-xs w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs">
                  <div>{getActivityName(log.activityId)}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(log.completedAt).toLocaleDateString()}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${INTENSITY_COLORS[log.intensity as IntensityLevel]}`}>
                    {t(`intensity.${log.intensity}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {t("progress.minutes", { count: Math.round(log.durationSecs / 60) })}
                </TableCell>
                <TableCell>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(t("progress.deleteConfirm"))) {
                        deleteMutation.mutate({ id: log.id });
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
