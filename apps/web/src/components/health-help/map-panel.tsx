import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Facility } from "./facility-list-panel";

// Fix default marker icons in Vite/bundler environments
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

// ── User location: blue pulsing dot ──────────────────────────────────────────

const userIcon = new L.DivIcon({
  className: "",
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:#3b82f6;border:3px solid #fff;
    box-shadow:0 0 0 2px #3b82f6,0 2px 6px rgba(0,0,0,.35);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12],
});

// ── Facility markers by type ─────────────────────────────────────────────────

function makeSvgIcon(color: string, glyph: string): L.DivIcon {
  return new L.DivIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z"
            fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <text x="16" y="18" text-anchor="middle" dominant-baseline="central"
            font-size="15" fill="#fff">${glyph}</text>
    </svg>`,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -36],
  });
}

const hospitalIcon = makeSvgIcon("#dc2626", "H");  // red pin with H
const clscIcon = makeSvgIcon("#16a34a", "C");       // green pin with C

function iconForType(type: string): L.DivIcon {
  return type === "hospital" ? hospitalIcon : clscIcon;
}

// ── Map helpers ──────────────────────────────────────────────────────────────

interface MapPanelProps {
  userLat: number;
  userLng: number;
  facilities: Facility[];
  selectedId: string | null;
}

function FitBounds({ userLat, userLng, facilities }: { userLat: number; userLng: number; facilities: Facility[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;
    const points: L.LatLngExpression[] = [
      [userLat, userLng],
      ...facilities.map((f) => [f.lat, f.lng] as L.LatLngExpression),
    ];
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
      fitted.current = true;
    }
  }, [map, userLat, userLng, facilities]);

  return null;
}

function PanToSelected({ facilities, selectedId }: { facilities: Facility[]; selectedId: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedId) return;
    const f = facilities.find((fac) => fac.msssName === selectedId);
    if (f) {
      map.setView([f.lat, f.lng], 14, { animate: true });
    }
  }, [map, selectedId, facilities]);

  return null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function MapPanel({ userLat, userLng, facilities, selectedId }: MapPanelProps) {
  const { t, i18n } = useTranslation("healthHelp");
  const isFr = i18n.language === "fr";

  return (
    <MapContainer
      center={[userLat, userLng]}
      zoom={10}
      style={{ width: "100%", height: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds userLat={userLat} userLng={userLng} facilities={facilities} />
      <PanToSelected facilities={facilities} selectedId={selectedId} />

      {/* User location */}
      <Marker position={[userLat, userLng]} icon={userIcon}>
        <Popup>{t("yourLocation")}</Popup>
      </Marker>

      {/* Facility markers */}
      {facilities.map((f) => {
        const name = isFr ? f.nameFr : f.nameEn;
        const er = f.erStats;
        return (
          <Marker key={f.msssName} position={[f.lat, f.lng]} icon={iconForType(f.type)}>
            <Popup>
              <div className="text-xs space-y-1">
                <strong>{name}</strong>
                <div className="opacity-70">{f.type === "hospital" ? t("hospital") : t("clsc")}</div>
                <div>{f.address}</div>
                <div>{t("distance", { distance: f.distanceKm.toFixed(1) })}</div>
                {er && er.occupancyRate !== null && (
                  <div>{t("occupancyRate")}: {er.occupancyRate}%</div>
                )}
                {er && (
                  <div>{t("patientsWaiting")}: {er.patientsWaiting}</div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
