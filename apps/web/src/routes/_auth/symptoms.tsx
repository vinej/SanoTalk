import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { Plus, Share2, Loader2, Flame, Smile, Zap, Moon, Brain, UtensilsCrossed } from "lucide-react";
import { LogSymptomDialog } from "../../components/symptoms/log-symptom-dialog";
import { SymptomChart } from "../../components/symptoms/symptom-chart";
import { SymptomHistoryTable } from "../../components/symptoms/symptom-history-table";
import { SCORE_CATEGORIES, getScoreColor, getScoreBgColor } from "../../components/symptoms/symptom-config";
import { cn } from "../../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";

export const Route = createFileRoute("/_auth/symptoms")({
  component: SymptomsPage,
});

const ICONS: Record<string, typeof Flame> = {
  painLevel: Flame,
  mood: Smile,
  energy: Zap,
  sleepQuality: Moon,
  stress: Brain,
  appetite: UtensilsCrossed,
};

type DateRange = "7d" | "30d" | "90d";

function getFromDate(range: DateRange): string {
  const d = new Date();
  if (range === "7d") d.setDate(d.getDate() - 7);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  else if (range === "90d") d.setDate(d.getDate() - 90);
  return d.toISOString().split("T")[0]!;
}

function SymptomsPage() {
  const { t, i18n } = useTranslation("symptoms");
  const [logOpen, setLogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("30d");

  const from = useMemo(() => getFromDate(dateRange), [dateRange]);
  const { data: allEntries = [], isLoading } = trpc.symptoms.list.useQuery();
  const { data: chartEntries = [] } = trpc.symptoms.list.useQuery({ from });

  const today = new Date().toISOString().split("T")[0]!;
  const todayEntry = allEntries.find((e) => e.date === today);

  function handleEdit(entry: any) {
    setEditEntry(entry);
    setLogOpen(true);
  }

  function handleDialogClose(open: boolean) {
    setLogOpen(open);
    if (!open) setEditEntry(null);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 px-6 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="h-3.5 w-3.5 mr-1.5" />
            {t("share")}
          </Button>
          <Button size="sm" onClick={() => { setEditEntry(null); setLogOpen(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t("logSymptoms")}
          </Button>
        </div>
      </div>

      {/* Today's summary cards */}
      <div className="flex flex-wrap gap-2 shrink-0">
        {SCORE_CATEGORIES.map((cat) => {
          const Icon = ICONS[cat.key]!;
          const val = todayEntry ? (todayEntry as any)[cat.key] as number | null : null;
          return (
            <div
              key={cat.key}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2",
                val != null ? getScoreBgColor(val, cat.max, cat.inverted) : "bg-muted/30"
              )}
            >
              <Icon className="h-4 w-4" style={{ color: cat.color }} />
              <div className="text-center">
                <p className={cn("text-lg font-bold tabular-nums", val != null ? getScoreColor(val, cat.max, cat.inverted) : "text-muted-foreground")}>
                  {val != null ? val : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">{t(cat.key)}</p>
              </div>
            </div>
          );
        })}
        {/* Sleep hours card */}
        <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2", todayEntry?.sleepHours != null ? "bg-cyan-50 dark:bg-cyan-950/30" : "bg-muted/30")}>
          <Moon className="h-4 w-4 text-cyan-500" />
          <div className="text-center">
            <p className={cn("text-lg font-bold tabular-nums", todayEntry?.sleepHours != null ? "text-cyan-600" : "text-muted-foreground")}>
              {todayEntry?.sleepHours != null ? `${todayEntry.sleepHours}h` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">{t("sleepHours")}</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="border rounded-lg overflow-hidden shrink-0">
        <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("chartTitle")}</span>
          <div className="flex gap-1">
            {(["7d", "30d", "90d"] as DateRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDateRange(r)}
                className={cn(
                  "px-2 py-0.5 text-xs rounded transition-colors",
                  dateRange === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t(`range.${r}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3">
          <SymptomChart data={chartEntries} />
        </div>
      </div>

      {/* History table */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/30">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("history")}</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <SymptomHistoryTable data={allEntries} onEdit={handleEdit} />
        )}
      </div>

      {/* Log/Edit dialog */}
      <LogSymptomDialog open={logOpen} onOpenChange={handleDialogClose} editEntry={editEntry} />

      {/* Share dialog */}
      <ShareSymptomsDialog open={shareOpen} onOpenChange={setShareOpen} language={i18n.language} />
    </div>
  );
}

// ── Share dialog ────────────────────────────────────────────────────────────

function ShareSymptomsDialog({ open, onOpenChange, language }: { open: boolean; onOpenChange: (v: boolean) => void; language: string }) {
  const { t } = useTranslation("symptoms");
  const { data: links = [] } = trpc.user.listLinkedUsers.useQuery(undefined, { enabled: open });
  const shareMutation = trpc.symptoms.shareWithProfessional.useMutation({
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
                onClick={() => shareMutation.mutate({ recipientUserId: prof.id, language: language as "en" | "fr" | "es" | "zh" | "ar" | "hi" })}
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
