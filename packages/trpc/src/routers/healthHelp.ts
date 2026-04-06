import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import hospitalsData from "../data/quebec-hospitals.json";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaticEntry {
  msssName: string;
  phone: string;
}

interface FacilityRecord {
  name: string;
  type: "hospital" | "clsc";
  address: string;
  region: string;
  lat: number;
  lng: number;
}

interface ParsedErRow {
  lastUpdated: string;
  facilityName: string;
  stretcherCount: number;
  stretchersOccupied: number;
  patientsOver24h: number;
  patientsOver48h: number;
  patientsWaiting: number;
  avgStretcherStayHours: number;
  avgAmbulatoryStayHours: number;
}

// ── Phone lookup from static JSON ────────────────────────────────────────────

const phoneBook = new Map<string, string>();
for (const h of hospitalsData as StaticEntry[]) {
  if (h.phone) phoneBook.set(h.msssName.toUpperCase().trim(), h.phone);
}

// ── Haversine ─────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

/** Parse a CSV row respecting quoted fields */
function parseCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseNum(val: string | undefined): number {
  if (!val || val.trim() === "") return 0;
  const n = parseFloat(val.replace(",", ".").trim());
  return Number.isNaN(n) ? 0 : n;
}

function formatPostalCode(raw: string): string {
  const clean = raw.replace(/\s/g, "");
  if (clean.length === 6) return clean.slice(0, 3) + " " + clean.slice(3);
  return raw;
}

// ── Installations CSV (Données Québec — all facilities) ──────────────────────

const INSTALLATIONS_URL =
  "https://www.donneesquebec.ca/recherche/dataset/51998b55-7d4c-4381-8c20-0ac1cd9c1b87/resource/2aa06e66-c1d0-4e2f-bf3c-c2e413c3f84d/download/installationscsv.csv";
const INSTALL_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days — rarely changes

let cachedFacilities: FacilityRecord[] | null = null;
let facilitiesCachedAt = 0;

function parseInstallationsCsv(text: string): FacilityRecord[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const header = parseCsvRow(lines[0]!, ",");
  const col = (name: string) =>
    header.findIndex((c) => c.trim().toUpperCase() === name.toUpperCase());

  const iName = col("INSTAL_NOM");
  const iAddr = col("ADRESSE");
  const iPostal = col("CODE_POSTA");
  const iMun = col("MUN_NOM");
  const iRegion = col("RSS_NOM");
  const iLat = col("LATITUDE");
  const iLng = col("LONGITUDE");
  const iCHSGS = col("CHSGS");
  const iCLSC = col("CLSC");

  const facilities: FacilityRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]!, ",");
    const isHospital = (cols[iCHSGS] ?? "").trim().toLowerCase() === "oui";
    const isCLSC = (cols[iCLSC] ?? "").trim().toLowerCase() === "oui";
    if (!isHospital && !isCLSC) continue;

    const lat = parseFloat(cols[iLat] ?? "");
    const lng = parseFloat(cols[iLng] ?? "");
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) continue;

    const name = (cols[iName] ?? "").trim();
    if (!name) continue;

    const addr = (cols[iAddr] ?? "").trim();
    const mun = (cols[iMun] ?? "").trim();
    const postal = formatPostalCode((cols[iPostal] ?? "").trim());
    const address = [addr, mun ? `${mun}, QC` : "", postal]
      .filter(Boolean)
      .join(", ");

    facilities.push({
      name,
      type: isHospital ? "hospital" : "clsc",
      address,
      region: (cols[iRegion] ?? "").trim(),
      lat,
      lng,
    });
  }

  return facilities;
}

// Static JSON hospitals — guaranteed ER facility list with coordinates
const staticHospitals: FacilityRecord[] = (
  hospitalsData as unknown as Array<{
    msssName: string;
    type: string;
    address: string;
    lat: number;
    lng: number;
    region: string;
  }>
).map((h) => ({
  name: h.msssName,
  type: "hospital" as const,
  address: h.address,
  region: h.region,
  lat: h.lat,
  lng: h.lng,
}));

async function fetchFacilities(): Promise<FacilityRecord[]> {
  const now = Date.now();
  if (cachedFacilities && now - facilitiesCachedAt < INSTALL_CACHE_TTL) {
    return cachedFacilities;
  }

  try {
    const res = await fetch(INSTALLATIONS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const csvFacilities = parseInstallationsCsv(text);

    if (csvFacilities.length > 0) {
      // Build lookup from CSV (official coords are more accurate)
      const csvMap = new Map<string, FacilityRecord>();
      for (const f of csvFacilities) {
        csvMap.set(f.name.toUpperCase().trim(), f);
      }

      // Hospitals: use static JSON for the complete ER list,
      // but prefer CSV coordinates/address when available
      const hospitals: FacilityRecord[] = staticHospitals.map((h) => {
        const csvEntry = csvMap.get(h.name.toUpperCase().trim());
        if (csvEntry) {
          return { ...csvEntry, type: "hospital" as const };
        }
        return h;
      });

      // Add any CHSGS hospitals from CSV not in static JSON
      const hospitalKeys = new Set(
        hospitals.map((h) => h.name.toUpperCase().trim())
      );
      const extraHospitals = csvFacilities.filter(
        (f) =>
          f.type === "hospital" &&
          !hospitalKeys.has(f.name.toUpperCase().trim())
      );

      // CLSCs: all from CSV that aren't already a hospital
      const allHospitalKeys = new Set(
        [...hospitalKeys, ...extraHospitals.map((h) => h.name.toUpperCase().trim())]
      );
      const clscs = csvFacilities.filter(
        (f) =>
          f.type === "clsc" &&
          !allHospitalKeys.has(f.name.toUpperCase().trim())
      );

      cachedFacilities = [...hospitals, ...extraHospitals, ...clscs];
      facilitiesCachedAt = now;
    }
  } catch {
    // Fallback: static JSON hospitals only (no CLSCs)
    if (!cachedFacilities) {
      cachedFacilities = staticHospitals;
    }
  }

  return cachedFacilities!;
}

// ── ER stats CSV (MSSS — hourly) ─────────────────────────────────────────────

const ER_CSV_URL =
  "https://www.msss.gouv.qc.ca/professionnels/statistiques/documents/urgences/Releve_horaire_urgences_7jours_nbpers.csv";
const ER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

let cachedErRows: ParsedErRow[] | null = null;
let erCachedAt = 0;

function parseErCsv(text: string): ParsedErRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const header = lines[0]!;
  const delimiter = header.includes(";") ? ";" : ",";
  const cols = parseCsvRow(header, delimiter);

  const idx = (name: string) =>
    cols.findIndex((c) => c.trim().toLowerCase().includes(name.toLowerCase()));

  const iDate = idx("Mise_a_jour");
  const iFacility = idx("Nom_installation");
  const iStretcherCount = idx("civieres_fonctionnelles");
  const iStretcherOccupied = idx("civieres_occupees");
  const iOver24 = idx("24h");
  const iOver48 = idx("48h");
  const iWaiting = idx("attente");
  const iDmsCiviere = idx("DMS_sur_civiere");
  const iDmsAmbul = idx("DMS_ambulatoire");

  const rows: ParsedErRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvRow(lines[i]!, delimiter);
    const facilityName = parts[iFacility] ?? "";
    if (
      !facilityName ||
      facilityName.startsWith("Total") ||
      facilityName.startsWith("Ensemble")
    )
      continue;

    rows.push({
      lastUpdated: parts[iDate] ?? "",
      facilityName,
      stretcherCount: parseNum(parts[iStretcherCount]),
      stretchersOccupied: parseNum(parts[iStretcherOccupied]),
      patientsOver24h: parseNum(parts[iOver24]),
      patientsOver48h: parseNum(parts[iOver48]),
      patientsWaiting: parseNum(parts[iWaiting]),
      avgStretcherStayHours: parseNum(parts[iDmsCiviere]),
      avgAmbulatoryStayHours: parseNum(parts[iDmsAmbul]),
    });
  }

  return rows;
}

function getLatestPerFacility(rows: ParsedErRow[]): Map<string, ParsedErRow> {
  const map = new Map<string, ParsedErRow>();
  for (const row of rows) {
    const key = row.facilityName.toUpperCase().trim();
    const existing = map.get(key);
    if (!existing || row.lastUpdated > existing.lastUpdated) {
      map.set(key, row);
    }
  }
  return map;
}

async function fetchErData(): Promise<Map<string, ParsedErRow>> {
  const now = Date.now();
  if (cachedErRows && now - erCachedAt < ER_CACHE_TTL) {
    return getLatestPerFacility(cachedErRows);
  }

  try {
    const res = await fetch(ER_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const text = new TextDecoder("iso-8859-1").decode(buf);
    cachedErRows = parseErCsv(text);
    erCachedAt = now;
  } catch {
    if (!cachedErRows) cachedErRows = [];
  }

  return getLatestPerFacility(cachedErRows);
}

// ── Router ────────────────────────────────────────────────────────────────────

export const healthHelpRouter = createTRPCRouter({
  nearestFacilities: protectedProcedure
    .input(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        perType: z.number().min(1).max(10).default(5),
      })
    )
    .query(async ({ input }) => {
      const { lat, lng, perType } = input;

      // Fetch facilities + ER data in parallel
      const [allFacilities, erMap] = await Promise.all([
        fetchFacilities(),
        fetchErData(),
      ]);

      // Promote any facility that has ER data to "hospital"
      // (many Centre multiservices have ERs but aren't flagged CHSGS)
      const promoted = allFacilities.map((h) => {
        if (h.type === "hospital") return h;
        const key = h.name.toUpperCase().trim();
        if (erMap.has(key)) return { ...h, type: "hospital" as const };
        return h;
      });

      // Compute distances
      const withDistance = promoted.map((h) => ({
        ...h,
        distanceKm:
          Math.round(haversineKm(lat, lng, h.lat, h.lng) * 10) / 10,
      }));
      withDistance.sort((a, b) => a.distanceKm - b.distanceKm);

      // Pick N nearest hospitals + N nearest CLSCs
      const hospitals = withDistance.filter((h) => h.type === "hospital").slice(0, perType);
      const clscs = withDistance.filter((h) => h.type === "clsc").slice(0, perType);
      const nearest = [...hospitals, ...clscs].sort((a, b) => a.distanceKm - b.distanceKm);

      return nearest.map((h) => {
        const key = h.name.toUpperCase().trim();
        const erRow = erMap.get(key) ?? null;
        const occupancyRate =
          erRow && erRow.stretcherCount > 0
            ? Math.round(
                (erRow.stretchersOccupied / erRow.stretcherCount) * 100
              )
            : null;

        return {
          msssName: h.name,
          nameFr: h.name,
          nameEn: h.name,
          type: h.type,
          address: h.address,
          lat: h.lat,
          lng: h.lng,
          region: h.region,
          phone: phoneBook.get(key) ?? "",
          distanceKm: h.distanceKm,
          directionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${h.lat},${h.lng}&travelmode=driving`,
          erStats: erRow
            ? {
                occupancyRate,
                stretcherCount: erRow.stretcherCount,
                stretchersOccupied: erRow.stretchersOccupied,
                patientsWaiting: erRow.patientsWaiting,
                patientsOver24h: erRow.patientsOver24h,
                patientsOver48h: erRow.patientsOver48h,
                avgStretcherStayHours: erRow.avgStretcherStayHours,
                avgAmbulatoryStayHours: erRow.avgAmbulatoryStayHours,
                lastUpdated: erRow.lastUpdated,
              }
            : null,
        };
      });
    }),
});
