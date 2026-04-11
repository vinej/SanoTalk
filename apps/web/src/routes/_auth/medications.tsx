import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { Plus, Share2, Loader2, Pill, PillBottle, ArrowLeft } from "lucide-react";
import { MedicationTable } from "../../components/medications/medication-table";
import { AddMedicationDialog } from "../../components/medications/add-medication-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";

export const Route = createFileRoute("/_auth/medications")({
  component: MedicationsPage,
});

function MedicationsPage() {
  const { t, i18n } = useTranslation("medications");
  const { data: allMeds = [], isLoading } = trpc.medications.list.useQuery();
  const [addOpen, setAddOpen] = useState(false);
  const [editMed, setEditMed] = useState<any>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const activeCount = allMeds.filter((m) => m.isActive).length;
  const inactiveCount = allMeds.length - activeCount;

  function handleEdit(med: any) {
    setEditMed(med);
    setAddOpen(true);
  }

  function handleDialogClose(open: boolean) {
    setAddOpen(open);
    if (!open) setEditMed(null);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 px-6 py-6 space-y-4">
      {/* Header */}
      <div className="shrink-0 space-y-1">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common:backToDashboard")}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
              {t("share")}
            </Button>
            <Button size="sm" onClick={() => { setEditMed(null); setAddOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t("addMedication")}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="flex gap-3 shrink-0">
        <div className="flex items-center gap-3 rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 px-4 py-3">
          <Pill className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-2xl font-bold text-green-700">{activeCount}</p>
            <p className="text-xs text-muted-foreground">{t("active")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/30 px-4 py-3">
          <PillBottle className="h-5 w-5 text-gray-500" />
          <div>
            <p className="text-2xl font-bold text-gray-500">{inactiveCount}</p>
            <p className="text-xs text-muted-foreground">{t("inactive")}</p>
          </div>
        </div>
      </div>

      {/* Medication table */}
      <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/30">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("medicationList")}</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <MedicationTable data={allMeds} onEdit={handleEdit} />
        )}
      </div>

      {/* Add/Edit dialog */}
      <AddMedicationDialog open={addOpen} onOpenChange={handleDialogClose} editMedication={editMed} />

      {/* Share dialog */}
      <ShareMedicationsDialog open={shareOpen} onOpenChange={setShareOpen} language={i18n.language} />
    </div>
  );
}

// ── Share dialog ────────────────────────────────────────────────────────────

function ShareMedicationsDialog({ open, onOpenChange, language }: { open: boolean; onOpenChange: (v: boolean) => void; language: string }) {
  const { t } = useTranslation("medications");
  const { data: links = [] } = trpc.user.listLinkedUsers.useQuery(undefined, { enabled: open });
  const shareMutation = trpc.medications.shareWithProfessional.useMutation({
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
