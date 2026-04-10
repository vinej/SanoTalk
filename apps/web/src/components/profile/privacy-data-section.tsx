import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Download, Trash2, Shield, AlertTriangle, CheckCircle, Bot } from "lucide-react";

export function PrivacyDataSection() {
  const { t } = useTranslation("privacy");
  const utils = trpc.useUtils();

  // ── AI data sharing consent ─────────────────────────────────────────────────
  const [showAiConfirm, setShowAiConfirm] = useState(false);

  const { data: aiConsent } = trpc.privacy.getAiDataSharingConsent.useQuery();
  const setAiConsent = trpc.privacy.setAiDataSharingConsent.useMutation({
    onSuccess: () => {
      setShowAiConfirm(false);
      void utils.privacy.getAiDataSharingConsent.invalidate();
      void utils.privacy.consentHistory.invalidate();
    },
  });

  function handleAiToggle() {
    if (aiConsent?.consented) {
      // Disabling — no confirmation needed
      setAiConsent.mutate({ consented: false });
    } else {
      // Enabling — show confirmation dialog
      setShowAiConfirm(true);
    }
  }

  // ── Data export ─────────────────────────────────────────────────────────────
  const [exportSuccess, setExportSuccess] = useState(false);

  const exportMutation = trpc.privacy.exportMyData.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sanotalk-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess(true);
    },
  });

  function handleExport() {
    setExportSuccess(false);
    exportMutation.mutate();
  }

  // ── Account deletion ────────────────────────────────────────────────────────
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: deletionStatus } = trpc.privacy.getDeletionStatus.useQuery();
  const requestDeletion = trpc.privacy.requestDeletion.useMutation({
    onSuccess: () => {
      setShowConfirm(false);
      void utils.privacy.getDeletionStatus.invalidate();
    },
  });
  const cancelDeletion = trpc.privacy.cancelDeletion.useMutation({
    onSuccess: () => void utils.privacy.getDeletionStatus.invalidate(),
  });

  const isPendingDeletion = !!deletionStatus?.deletionScheduledFor;

  // ── Consent history ─────────────────────────────────────────────────────────
  const { data: consentHistory = [] } = trpc.privacy.consentHistory.useQuery();

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <Label className="text-base font-semibold">{t("title")}</Label>
      </div>

      {/* AI data sharing consent */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-medium">{t("aiDataSharing.title")}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t("aiDataSharing.description")}</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={aiConsent?.consented ?? false}
            onChange={handleAiToggle}
            disabled={setAiConsent.isPending}
            className="mt-1 h-4 w-4 accent-primary cursor-pointer shrink-0"
          />
        </div>
        <p className="text-xs text-muted-foreground italic ml-8">
          {aiConsent?.consented ? t("aiDataSharing.statusEnabled") : t("aiDataSharing.statusDisabled")}
        </p>
      </div>

      {/* Data export */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-medium">{t("export.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("export.description")}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExport}
          disabled={exportMutation.isPending}
        >
          {exportMutation.isPending ? (
            <>{t("export.downloading")}</>
          ) : exportSuccess ? (
            <><CheckCircle className="h-4 w-4 mr-1.5" />{t("export.success")}</>
          ) : (
            <><Download className="h-4 w-4 mr-1.5" />{t("export.button")}</>
          )}
        </Button>
      </div>

      {/* Account deletion */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h3 className="text-sm font-medium">{t("deletion.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("deletion.description")}</p>
        <p className="text-xs text-muted-foreground">{t("deletion.gracePeriod")}</p>

        {isPendingDeletion ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">{t("deletion.pendingMessage")}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("deletion.scheduledFor", {
                date: new Date(deletionStatus!.deletionScheduledFor!).toLocaleDateString(),
              })}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => cancelDeletion.mutate()}
              disabled={cancelDeletion.isPending}
            >
              {t("deletion.cancelButton")}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowConfirm(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {t("deletion.requestButton")}
          </Button>
        )}
      </div>

      {/* Consent history */}
      {consentHistory.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-medium">{t("consentHistory.title")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-1 pr-3">{t("consentHistory.type")}</th>
                  <th className="text-left py-1 pr-3">{t("consentHistory.status")}</th>
                  <th className="text-left py-1 pr-3">{t("consentHistory.date")}</th>
                  <th className="text-left py-1">{t("consentHistory.policyVersion")}</th>
                </tr>
              </thead>
              <tbody>
                {consentHistory.slice(0, 20).map((r) => (
                  <tr key={r.id} className="border-b border-muted">
                    <td className="py-1 pr-3 capitalize">{r.consentType.replace("_", " ")}</td>
                    <td className="py-1 pr-3">
                      {r.consented ? (
                        <span className="text-green-600 dark:text-green-400">{t("consentHistory.consented")}</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">{t("consentHistory.withdrawn")}</span>
                      )}
                    </td>
                    <td className="py-1 pr-3 text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-1 text-muted-foreground">{r.policyVersion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI data sharing confirmation dialog */}
      <Dialog open={showAiConfirm} onOpenChange={setShowAiConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("aiDataSharing.confirmTitle")}</DialogTitle>
            <DialogDescription>{t("aiDataSharing.confirmMessage")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAiConfirm(false)}>
              {t("aiDataSharing.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={() => setAiConsent.mutate({ consented: true })}
              disabled={setAiConsent.isPending}
            >
              {t("aiDataSharing.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deletion confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deletion.confirmTitle")}</DialogTitle>
            <DialogDescription>{t("deletion.confirmMessage")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
              {t("deletion.cancelButton")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => requestDeletion.mutate()}
              disabled={requestDeletion.isPending}
            >
              {t("deletion.confirmButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
