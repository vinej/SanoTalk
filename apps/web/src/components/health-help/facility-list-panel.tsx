import { useTranslation } from "react-i18next";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { MapPin, Phone, Navigation, Clock, AlertTriangle } from "lucide-react";

export interface Facility {
  msssName: string;
  nameFr: string;
  nameEn: string;
  type: string;
  address: string;
  lat: number;
  lng: number;
  region: string;
  phone: string;
  distanceKm: number;
  directionsUrl: string;
  erStats: {
    occupancyRate: number | null;
    stretcherCount: number;
    stretchersOccupied: number;
    patientsWaiting: number;
    patientsOver24h: number;
    patientsOver48h: number;
    avgStretcherStayHours: number;
    avgAmbulatoryStayHours: number;
    lastUpdated: string;
  } | null;
}

interface FacilityListPanelProps {
  facilities: Facility[];
  selectedId: string | null;
  onSelect: (msssName: string) => void;
}

function occupancyColor(rate: number | null): string {
  if (rate === null) return "bg-muted text-muted-foreground";
  if (rate < 80) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (rate < 120) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
}

export function FacilityListPanel({ facilities, selectedId, onSelect }: FacilityListPanelProps) {
  const { t, i18n } = useTranslation("healthHelp");
  const isFr = i18n.language === "fr";

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-3">
        {facilities.map((f, idx) => {
          const name = isFr ? f.nameFr : f.nameEn;
          const isSelected = selectedId === f.msssName;
          const er = f.erStats;

          return (
            <button
              key={f.msssName}
              type="button"
              onClick={() => onSelect(f.msssName)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">{idx + 1}</span>
                    <h3 className="text-sm font-semibold truncate">{name}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                      f.type === "hospital" ? "border-red-300 text-red-700 dark:border-red-800 dark:text-red-400" :
                      f.type === "pharmacy" ? "border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-400" :
                      "border-green-300 text-green-700 dark:border-green-800 dark:text-green-400"
                    }`}>
                      {f.type === "hospital" ? t("hospital") : f.type === "pharmacy" ? t("pharmacy") : t("clsc")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {t("distance", { distance: f.distanceKm.toFixed(1) })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-2">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{f.address}</span>
              </div>

              {/* ER Stats */}
              {er ? (
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <div className={`rounded px-2 py-1 text-center ${occupancyColor(er.occupancyRate)}`}>
                    <div className="text-[10px] font-medium">{t("occupancyRate")}</div>
                    <div className="text-sm font-bold">{er.occupancyRate ?? "—"}%</div>
                  </div>
                  <div className="rounded px-2 py-1 text-center bg-muted">
                    <div className="text-[10px] font-medium text-muted-foreground">{t("patientsWaiting")}</div>
                    <div className="text-sm font-bold">{er.patientsWaiting}</div>
                  </div>
                  <div className="rounded px-2 py-1 text-center bg-muted">
                    <div className="text-[10px] font-medium text-muted-foreground">{t("avgWait")}</div>
                    <div className="text-sm font-bold">
                      {er.avgAmbulatoryStayHours > 0
                        ? t("avgWaitValue", { hours: er.avgAmbulatoryStayHours.toFixed(1) })
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded px-2 py-1 text-center bg-muted">
                    <div className="text-[10px] font-medium text-muted-foreground">{t("stretcherCount")}</div>
                    <div className="text-sm font-bold">{er.stretchersOccupied}/{er.stretcherCount}</div>
                  </div>
                  <div className="rounded px-2 py-1 text-center bg-muted">
                    <div className="text-[10px] font-medium text-muted-foreground">{t("patientsOver24h")}</div>
                    <div className="text-sm font-bold">{er.patientsOver24h}</div>
                  </div>
                  <div className="rounded px-2 py-1 text-center bg-muted">
                    <div className="text-[10px] font-medium text-muted-foreground">{t("patientsOver48h")}</div>
                    <div className="text-sm font-bold">{er.patientsOver48h}</div>
                  </div>
                </div>
              ) : f.type !== "pharmacy" ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <AlertTriangle className="h-3 w-3" />
                  {t("erDataUnavailable")}
                </div>
              ) : null}

              {/* Last updated */}
              {er?.lastUpdated && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
                  <Clock className="h-2.5 w-2.5" />
                  {t("lastUpdated", { time: er.lastUpdated })}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex-1"
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <a href={f.directionsUrl} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-3 w-3 mr-1" />
                    {t("getDirections")}
                  </a>
                </Button>
                {f.phone && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a href={`tel:${f.phone}`}>
                      <Phone className="h-3 w-3 mr-1" />
                      {t("call")}
                    </a>
                  </Button>
                )}
              </div>
            </button>
          );
        })}

        {/* Attribution */}
        <p className="text-[10px] text-muted-foreground text-center pt-2 pb-1">
          {t("dataSource")}
        </p>
      </div>
    </ScrollArea>
  );
}
