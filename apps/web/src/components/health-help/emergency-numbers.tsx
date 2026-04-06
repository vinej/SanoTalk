import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Phone, ChevronDown, ChevronUp } from "lucide-react";

export function EmergencyNumbers({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const { t } = useTranslation("healthHelp");
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-red-600" />
          <span className="text-sm font-semibold text-red-700 dark:text-red-400">
            {t("emergencyNumbers")}
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-red-600" />
          : <ChevronDown className="h-4 w-4 text-red-600" />}
      </button>
      {open && (
        <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <a href="tel:911" className="flex items-center gap-2 rounded-md border border-red-200 dark:border-red-800 bg-white dark:bg-red-950/50 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
            <span className="text-lg font-bold text-red-600">911</span>
            <span className="text-xs text-muted-foreground">{t("emergency911")}</span>
          </a>
          <a href="tel:811" className="flex items-center gap-2 rounded-md border border-blue-200 dark:border-blue-800 bg-white dark:bg-blue-950/50 px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
            <span className="text-lg font-bold text-blue-600">811</span>
            <span className="text-xs text-muted-foreground">{t("infoSante811")}</span>
          </a>
          <a href="tel:18004635060" className="flex items-center gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-white dark:bg-amber-950/50 px-3 py-2 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors">
            <span className="text-sm font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">1-800-463-5060</span>
            <span className="text-xs text-muted-foreground">{t("poisonControl")}</span>
          </a>
          <a href="tel:18662773553" className="flex items-center gap-2 rounded-md border border-purple-200 dark:border-purple-800 bg-white dark:bg-purple-950/50 px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors">
            <span className="text-sm font-bold text-purple-700 dark:text-purple-400 whitespace-nowrap">1-866-APPELLE</span>
            <span className="text-xs text-muted-foreground">{t("suicidePrevention")}</span>
          </a>
          <a href="tel:18003639010" className="flex items-center gap-2 rounded-md border border-rose-200 dark:border-rose-800 bg-white dark:bg-rose-950/50 px-3 py-2 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors">
            <span className="text-sm font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">1-800-363-9010</span>
            <span className="text-xs text-muted-foreground">{t("domesticViolence")}</span>
          </a>
        </div>
      )}
    </div>
  );
}
