import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AiChatPanel } from "../../components/chat/ai-chat-panel";
import { AiTransparencyNotice } from "../../components/ai-transparency-notice";

export const Route = createFileRoute("/_auth/drug-info")({
  component: DrugInfoPage,
});

const COVERAGE_COUNT = 7;

function DrugInfoPage() {
  const { t } = useTranslation(["common", "profile"]);

  const coverageItems = useMemo(() => {
    const items: string[] = [];
    for (let i = 0; i < COVERAGE_COUNT; i++) {
      items.push(t(`profile:ramqCoverage.coverage_${i}`));
    }
    return items;
  }, [t]);

  return (
    <div className="flex-1 min-h-0 p-4 flex flex-col gap-2">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("common:backToDashboard")}
      </Link>

      <details className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 px-4 py-3 shrink-0">
        <summary className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
          <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
          {t("profile:ramqCoverage.title")}
        </summary>
        <ul className="mt-2 space-y-1 pl-6 text-xs text-muted-foreground list-disc">
          {coverageItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground/70 italic">
          {t("profile:ramqCoverage.note")}{" "}
          <a
            href="https://www.ramq.gouv.qc.ca"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            ramq.gouv.qc.ca
          </a>
        </p>
      </details>

      <AiTransparencyNotice />
      <AiChatPanel variant="drugInfo" />
    </div>
  );
}
