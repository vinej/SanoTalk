import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { getStoredConsent } from "./cookie-consent-banner";

interface CookieSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (analytics: boolean) => void;
}

export function CookieSettingsDialog({ open, onOpenChange, onSave }: CookieSettingsDialogProps) {
  const { t } = useTranslation("privacy");
  const stored = getStoredConsent();
  const [analytics, setAnalytics] = useState(stored?.analytics ?? false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("consent.settings.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Essential — always on */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t("consent.categories.essential")}</p>
              <p className="text-xs text-muted-foreground">{t("consent.categories.essentialDesc")}</p>
            </div>
            <input type="checkbox" checked disabled className="mt-0.5 h-4 w-4 accent-primary" />
          </div>

          {/* Analytics — toggleable */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t("consent.categories.analytics")}</p>
              <p className="text-xs text-muted-foreground">{t("consent.categories.analyticsDesc")}</p>
            </div>
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary cursor-pointer"
            />
          </div>
        </div>

        <DialogFooter>
          <Button size="sm" onClick={() => onSave(analytics)}>
            {t("consent.settings.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
