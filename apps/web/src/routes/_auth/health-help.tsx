import { useCallback, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { useGeolocation } from "../../hooks/use-geolocation";
import { FacilityListPanel } from "../../components/health-help/facility-list-panel";
import { MapPanel } from "../../components/health-help/map-panel";
import { EmergencyNumbers } from "../../components/health-help/emergency-numbers";
import { Button } from "../../components/ui/button";
import { AiTransparencyNotice } from "../../components/ai-transparency-notice";
import { MapPin, RefreshCw, Loader2, Bell, ArrowLeft } from "lucide-react";

export type FacilityType = "hospital" | "clsc" | "pharmacy" | "clinic";

export const Route = createFileRoute("/_auth/health-help")({
  component: HealthHelpPage,
});

function HealthHelpPage() {
  const { t } = useTranslation(["healthHelp", "common"]);
  const { lat, lng, error, loading: geoLoading, requestLocation } = useGeolocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<FacilityType>>(
    new Set(["hospital", "clsc", "clinic", "pharmacy"])
  );

  // Resizable split panel
  const [leftPercent, setLeftPercent] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftPercent(Math.max(25, Math.min(75, pct)));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Favorites
  const { data: favoriteNames = [] } = trpc.healthHelp.listFavorites.useQuery();
  const favoritesSet = useMemo(() => new Set(favoriteNames), [favoriteNames]);
  const utils = trpc.useUtils();
  const addFav = trpc.healthHelp.addFavorite.useMutation({ onSuccess: () => void utils.healthHelp.listFavorites.invalidate() });
  const removeFav = trpc.healthHelp.removeFavorite.useMutation({ onSuccess: () => void utils.healthHelp.listFavorites.invalidate() });

  function handleToggleFavorite(facilityName: string) {
    if (favoritesSet.has(facilityName)) {
      removeFav.mutate({ facilityName });
    } else {
      addFav.mutate({ facilityName });
    }
  }

  const { data: facilities = [], isLoading } = trpc.healthHelp.nearestFacilities.useQuery(
    { lat: lat!, lng: lng!, perType: 5 },
    { enabled: lat !== null && lng !== null }
  );

  const filteredFacilities = useMemo(
    () => {
      const filtered = facilities.filter((f) => visibleTypes.has(f.type as FacilityType));
      // Sort favorites first, then by distance
      return filtered.sort((a, b) => {
        const aFav = favoritesSet.has(a.msssName) ? 0 : 1;
        const bFav = favoritesSet.has(b.msssName) ? 0 : 1;
        if (aFav !== bFav) return aFav - bFav;
        return a.distanceKm - b.distanceKm;
      });
    },
    [facilities, visibleTypes, favoritesSet]
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
        <div className="px-4 pt-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("common:backToDashboard")}
          </Link>
        </div>
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
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("common:backToDashboard")}
          </Link>
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {favoritesSet.size > 0 && (
            <Button size="sm" variant="outline" asChild>
              <Link to="/er-alerts">
                <Bell className="h-3.5 w-3.5 mr-1" />
                {t("erAlerts")}
              </Link>
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={requestLocation} disabled={geoLoading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${geoLoading ? "animate-spin" : ""}`} />
            {t("refreshLocation")}
          </Button>
        </div>
      </div>

      {/* AI transparency notice */}
      <div className="px-4 pt-2">
        <AiTransparencyNotice />
      </div>

      {/* Emergency numbers */}
      <EmergencyNumbers />

      {/* Split layout — stacked on mobile, resizable side-by-side on lg+ */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row" ref={containerRef}>
        {/* Left: Facility list */}
        <div className="h-1/2 lg:h-full overflow-hidden min-w-0" style={{ flexBasis: `${leftPercent}%`, flexShrink: 0 }}>
          <FacilityListPanel
            facilities={filteredFacilities}
            selectedId={selectedId}
            onSelect={setSelectedId}
            favorites={favoritesSet}
            onToggleFavorite={handleToggleFavorite}
          />
        </div>

        {/* Drag handle */}
        <div
          className="hidden lg:flex items-center justify-center w-2 cursor-col-resize bg-border hover:bg-primary/20 active:bg-primary/30 transition-colors select-none shrink-0"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="w-0.5 h-8 rounded-full bg-muted-foreground/40" />
        </div>

        {/* Right: Map */}
        <div className="flex-1 min-h-[300px]">
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
  );
}
