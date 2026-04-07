import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { Plus, Share2, Loader2 } from "lucide-react";
import { VitalSummaryCard } from "../../components/vitals/vital-summary-card";
import { VitalChart } from "../../components/vitals/vital-chart";
import { LogVitalDialog } from "../../components/vitals/log-vital-dialog";
import { VitalHistoryTable } from "../../components/vitals/vital-history-table";
import { VITAL_CONFIGS, type VitalType } from "../../components/vitals/vital-config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";

export const Route = createFileRoute("/_auth/vitals")({
  component: VitalsPage,
});

type DateRange = "7d" | "30d" | "90d" | "1y" | "all";

function getFromDate(range: DateRange): string | undefined {
  if (range === "all") return undefined;
  const d = new Date();
  if (range === "7d") d.setDate(d.getDate() - 7);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  else if (range === "90d") d.setDate(d.getDate() - 90);
  else if (range === "1y") d.setFullYear(d.getFullYear() - 1);
  return d.toISOString();
}

function VitalsPage() {
  const { t, i18n } = useTranslation("vitals");
  const [selectedType, setSelectedType] = useState<VitalType>("blood_pressure");
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [logOpen, setLogOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const from = useMemo(() => getFromDate(dateRange), [dateRange]);
  const { data: latest = {} } = trpc.vitals.latest.useQuery();
  const { data: allReadings = [], isLoading } = trpc.vitals.list.useQuery({
    type: selectedType,
    from,
  });

  // For the history table: show all types
  const { data: recentAll = [] } = trpc.vitals.list.useQuery({ limit: 50 });

  return (
    <div className="flex-1 flex flex-col min-h-0 px-6 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="h-3.5 w-3.5 mr-1.5" />
            {t("share")}
          </Button>
          <Button size="sm" onClick={() => setLogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t("logReading")}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 shrink-0">
        {VITAL_CONFIGS.map((cfg) => {
          const rec = latest[cfg.type as keyof typeof latest];
          return (
            <VitalSummaryCard
              key={cfg.type}
              type={cfg.type}
              valuePrimary={rec?.valuePrimary ?? null}
              valueSecondary={rec?.valueSecondary ?? null}
              measuredAt={rec?.measuredAt ? String(rec.measuredAt) : null}
              selected={selectedType === cfg.type}
              onClick={() => setSelectedType(cfg.type)}
            />
          );
        })}
      </div>

      {/* Chart + date range */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <h2 className="text-sm font-semibold" style={{ color: VITAL_CONFIGS.find(c => c.type === selectedType)?.color }}>
            {t(`types.${selectedType}`)}
          </h2>
          <div className="flex gap-1">
            {(["7d", "30d", "90d", "1y", "all"] as DateRange[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={dateRange === r ? "default" : "ghost"}
                className="h-7 text-xs px-2"
                onClick={() => setDateRange(r)}
              >
                {t(`range.${r}`)}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-[200px] max-h-[350px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <VitalChart type={selectedType} data={allReadings} />
          )}
        </div>
      </div>

      {/* History table */}
      <div className="shrink-0 border rounded-lg max-h-[250px] overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/30">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("history")}</span>
        </div>
        <VitalHistoryTable data={recentAll} selectedType={selectedType} />
      </div>

      {/* Log dialog */}
      <LogVitalDialog open={logOpen} onOpenChange={setLogOpen} defaultType={selectedType} />

      {/* Share dialog */}
      <ShareVitalsDialog open={shareOpen} onOpenChange={setShareOpen} language={i18n.language} />
    </div>
  );
}

// ── Share dialog ────────────────────────────────────────────────────────────

function ShareVitalsDialog({ open, onOpenChange, language }: { open: boolean; onOpenChange: (v: boolean) => void; language: string }) {
  const { t } = useTranslation("vitals");
  const { data: links = [] } = trpc.user.listLinkedUsers.useQuery(undefined, { enabled: open });
  const shareMutation = trpc.vitals.shareWithProfessional.useMutation({
    onSuccess: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("shareTitle")}</DialogTitle>
          <DialogDescription>{t("shareDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t("noLinkedProfessionals")}</p>
          ) : (
            links.map((prof: any) => (
              <Button
                key={prof.id}
                variant="outline"
                className="w-full justify-start"
                disabled={shareMutation.isPending}
                onClick={() => shareMutation.mutate({ recipientUserId: prof.id, language })}
              >
                {shareMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Share2 className="h-3.5 w-3.5 mr-2" />}
                {prof.name} — {prof.role === "doctor" ? t("doctor") : t("pharmacist")}
              </Button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
