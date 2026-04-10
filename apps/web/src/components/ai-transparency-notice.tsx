import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Bot, X } from "lucide-react";

const DISMISSED_KEY = "sanotalk-ai-notice-dismissed";

export function AiTransparencyNotice() {
  const { t } = useTranslation("privacy");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) !== "true") {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 flex items-start gap-3">
      <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
      <p className="text-xs text-blue-700 dark:text-blue-300 flex-1">
        {t("ai.transparencyNotice")}
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-200 shrink-0"
        aria-label={t("ai.dismiss")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
