import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { EXTERNAL_RESOURCES } from "./external-resources";

export function OutdoorResourceList() {
  const { t } = useTranslation("goOutside");

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{t("resources.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("resources.subtitle")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {EXTERNAL_RESOURCES.map((res) => (
          <a
            key={res.id}
            href={res.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow flex flex-col gap-1"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{t(`resourceNames.${res.id}`)}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground">
              {t(`resourceNames.${res.id}Desc`)}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
