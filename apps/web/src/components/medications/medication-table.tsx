import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Trash2, Pencil, Loader2 } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { ScrollArea } from "../ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";

interface MedicationRecord {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route?: string | null;
  prescribedBy?: string | null;
  reason?: string | null;
  startDate: string | Date;
  endDate?: string | Date | null;
  isActive: boolean;
  notes?: string | null;
}

interface Props {
  data: MedicationRecord[];
  onEdit: (med: MedicationRecord) => void;
}

export function MedicationTable({ data, onEdit }: Props) {
  const { t } = useTranslation("medications");
  const utils = trpc.useUtils();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const deleteMutation = trpc.medications.delete.useMutation({
    onSuccess: () => {
      void utils.medications.list.invalidate();
      setConfirmId(null);
    },
  });

  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        {t("noMedications")}
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        {/* Mobile: card layout */}
        <div className="sm:hidden divide-y">
          {data.map((row) => (
            <div key={row.id} className="p-3 flex gap-2">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{row.name}</span>
                  <Badge variant="secondary" className={row.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                    {row.isActive ? t("active") : t("inactive")}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {row.dosage} &middot; {t(`freq.${row.frequency}`, row.frequency)}
                </div>
                {row.prescribedBy && (
                  <div className="text-xs text-muted-foreground">{t("prescribedBy")}: {row.prescribedBy}</div>
                )}
                <div className="text-xs text-muted-foreground">
                  {t("startDate")}: {new Date(row.startDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
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
                  onClick={() => setConfirmId(row.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: table layout */}
        <table className="hidden sm:table w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground text-xs">
              <th className="text-left py-2 px-2 font-medium">{t("name")}</th>
              <th className="text-left py-2 px-2 font-medium">{t("dosage")}</th>
              <th className="text-left py-2 px-2 font-medium">{t("frequency")}</th>
              <th className="text-left py-2 px-2 font-medium">{t("prescribedBy")}</th>
              <th className="text-left py-2 px-2 font-medium">{t("startDate")}</th>
              <th className="text-center py-2 px-2 font-medium">{t("status")}</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2 px-2 font-medium">{row.name}</td>
                <td className="py-2 px-2">{row.dosage}</td>
                <td className="py-2 px-2 text-xs">{t(`freq.${row.frequency}`, row.frequency)}</td>
                <td className="py-2 px-2 text-xs text-muted-foreground">{row.prescribedBy || "—"}</td>
                <td className="py-2 px-2 text-xs">
                  {new Date(row.startDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                </td>
                <td className="py-2 px-2 text-center">
                  <Badge variant="secondary" className={row.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                    {row.isActive ? t("active") : t("inactive")}
                  </Badge>
                </td>
                <td className="py-2 px-1 flex gap-1 justify-end">
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
                    onClick={() => setConfirmId(row.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>

      <Dialog open={confirmId !== null} onOpenChange={(v) => { if (!v) setConfirmId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("confirmDelete")}</DialogTitle>
            <DialogDescription>{t("confirmDeleteDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmId(null)}>{t("cancel")}</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => { if (confirmId) deleteMutation.mutate({ id: confirmId }); }}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
