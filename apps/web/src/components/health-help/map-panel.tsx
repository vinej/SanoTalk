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

// ── User location: orange pulsing dot ────────────────────────────────────────

const USER_COLOR = "#f97316"; // orange-500

const userIcon = new L.DivIcon({
  className: "",
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:${USER_COLOR};border:3px solid #fff;
    box-shadow:0 0 0 2px ${USER_COLOR},0 2px 6px rgba(0,0,0,.35);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12],
});

// ── Facility markers by type ─────────────────────────────────────────────────

function makeSvgIcon(color: string, glyph: string, size: [number, number] = [32, 40]): L.DivIcon {
  const [w, h] = size;
  const cx = w / 2;
  const cy = w / 2; // text centered in the circle part
  const fs = Math.round(w * 0.47);
  return new L.DivIcon({
    className: "",
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <path d="M${cx} 0C${cx * 0.4475} 0 0 ${cx * 0.4475} 0 ${cx}c0 ${cx * 0.75} ${cx} ${h - cx} ${cx} ${h - cx}s${cx}-${(h - cx) * 0.5} ${cx}-${h - cx}C${w} ${cx * 0.4475} ${w - cx * 0.4475} 0 ${cx} 0z"
            fill="${color}" stroke="#fff" stroke-width="1.5"/>
      <text x="${cx}" y="${cy + 2}" text-anchor="middle" dominant-baseline="central"
            font-size="${fs}" fill="#fff">${glyph}</text>
    </svg>`,
    iconSize: [w, h],
    iconAnchor: [cx, h],
    popupAnchor: [0, -h + 4],
  });
}

const hospitalIcon = makeSvgIcon("#dc2626", "H");              // red pin with H
const clscIcon = makeSvgIcon("#16a34a", "C");                  // green pin with C
const pharmacyIcon = makeSvgIcon("#2563eb", "P", [26, 33]);    // smaller blue pin with P

function iconForType(type: string): L.DivIcon {
  if (type === "hospital") return hospitalIcon;
  if (type === "pharmacy") return pharmacyIcon;
  return clscIcon;
}

// ── Map helpers ──────────────────────────────────────────────────────────────

type FacilityType = "hospital" | "clsc" | "pharmacy";

interface MapPanelProps {
  userLat: number;
  userLng: number;
  facilities: Facility[];
  selectedId: string | null;
  visibleTypes: Set<FacilityType>;
  onToggleType: (type: FacilityType) => void;
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

const LEGEND_ITEMS: { type: FacilityType; color: string; glyph: string }[] = [
  { type: "hospital", color: "#dc2626", glyph: "H" },
  { type: "clsc", color: "#16a34a", glyph: "C" },
  { type: "pharmacy", color: "#2563eb", glyph: "P" },
];

export function MapPanel({ userLat, userLng, facilities, selectedId, visibleTypes, onToggleType }: MapPanelProps) {
  const { t, i18n } = useTranslation("healthHelp");
  const isFr = i18n.language === "fr";

  return (
    <div className="relative w-full h-full">
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
                <div className="opacity-70">{f.type === "hospital" ? t("hospital") : f.type === "pharmacy" ? t("pharmacy") : t("clsc")}</div>
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

      {/* Legend – rendered after map so it paints on top */}
      <div
        className="absolute top-2 right-2 bg-white/95 dark:bg-zinc-900/95 rounded-lg shadow-md border px-2 py-1.5 flex gap-3"
        style={{ zIndex: 9999 }}
      >
        {LEGEND_ITEMS.map(({ type, color, glyph }) => (
          <label key={type} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={visibleTypes.has(type)}
              onChange={() => onToggleType(type)}
              className="accent-current h-3.5 w-3.5 rounded cursor-pointer"
              style={{ accentColor: color }}
            />
            <span
              className="inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: color, width: 18, height: 18 }}
            >
              {glyph}
            </span>
            <span className="text-xs">
              {type === "hospital" ? t("hospital") : type === "pharmacy" ? t("pharmacy") : t("clsc")}
            </span>
          </label>
        ))}
        {/* User location – no checkbox */}
        <div className="flex items-center gap-1.5 select-none border-l pl-3">
          <span
            className="inline-block rounded-full"
            style={{ background: USER_COLOR, width: 12, height: 12, border: "2px solid #fff", boxShadow: `0 0 0 1.5px ${USER_COLOR}` }}
          />
          <span className="text-xs">{t("yourLocation")}</span>
        </div>
      </div>
    </div>
  );
}
