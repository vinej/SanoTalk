import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { useGeolocation } from "../../hooks/use-geolocation";
import { FacilityListPanel } from "../../components/health-help/facility-list-panel";
import { MapPanel } from "../../components/health-help/map-panel";
import { EmergencyNumbers } from "../../components/health-help/emergency-numbers";
import { Button } from "../../components/ui/button";
import { MapPin, RefreshCw, Loader2 } from "lucide-react";

export type FacilityType = "hospital" | "clsc" | "pharmacy";

export const Route = createFileRoute("/_auth/health-help")({
  component: HealthHelpPage,
});

function HealthHelpPage() {
  const { t } = useTranslation(["healthHelp", "common"]);
  const { lat, lng, error, loading: geoLoading, requestLocation } = useGeolocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<FacilityType>>(
    new Set(["hospital", "clsc", "pharmacy"])
  );

  const { data: facilities = [], isLoading } = trpc.healthHelp.nearestFacilities.useQuery(
    { lat: lat!, lng: lng!, perType: 5 },
    { enabled: lat !== null && lng !== null }
  );

  const filteredFacilities = useMemo(
    () => facilities.filter((f) => visibleTypes.has(f.type as FacilityType)),
    [facilities, visibleTypes]
  );

  function toggleType(type: FacilityType) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  // No location yet — prompt
  if (lat === null || lng === null) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <EmergencyNumbers />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-sm">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>

            {error === "permission_denied" && (
              <p className="text-sm text-destructive">{t("locationDenied")}</p>
            )}
            {error === "position_unavailable" && (
              <p className="text-sm text-destructive">{t("locationUnavailable")}</p>
            )}
            {error === "timeout" && (
              <p className="text-sm text-destructive">{t("locationUnavailable")}</p>
            )}
            {!error && (
              <p className="text-sm text-muted-foreground">{t("requestLocation")}</p>
            )}

            <Button onClick={requestLocation} disabled={geoLoading}>
              {geoLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("loading")}</>
              ) : (
                <><MapPin className="h-4 w-4 mr-2" />{t("requestLocationButton")}</>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading facilities
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <EmergencyNumbers />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">{t("loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div>
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={requestLocation} disabled={geoLoading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${geoLoading ? "animate-spin" : ""}`} />
          {t("refreshLocation")}
        </Button>
      </div>

      {/* Emergency numbers */}
      <EmergencyNumbers />

      {/* Split layout */}
      <div className="flex-1 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-1 h-full gap-0">
          {/* Left: Facility list */}
          <div className="border-r h-full overflow-hidden">
            <FacilityListPanel
              facilities={filteredFacilities}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>

          {/* Right: Map */}
          <div className="h-full min-h-[300px]">
            <MapPanel
              userLat={lat}
              userLng={lng}
              facilities={filteredFacilities}
              selectedId={selectedId}
              visibleTypes={visibleTypes}
              onToggleType={toggleType}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
