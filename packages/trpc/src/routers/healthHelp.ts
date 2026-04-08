import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { erFavorite, erSnapshot } from "@sanotalk/db";
import { eq, and, desc, gte, sql, avg } from "drizzle-orm";
import hospitalsData from "../data/quebec-hospitals.json";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaticEntry {
  msssName: string;
  phone: string;
}

interface FacilityRecord {
  name: string;
  type: "hospital" | "clsc" | "pharmacy" | "clinic";
  address: string;
  region: string;
  lat: number;
  lng: number;
}

export interface ParsedErRow {
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

/** Strip HTML/script injection characters from external facility names. */
function sanitizeFacilityName(name: string): string {
  return name.replace(/[<>"'&]/g, "").slice(0, 200).trim() || "Unknown";
}

/** Allow only phone-safe characters. */
function sanitizePhone(phone: string): string {
  return phone.replace(/[^0-9+\-().\s]/g, "").slice(0, 30);
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

    const name = sanitizeFacilityName((cols[iName] ?? "").trim());
    if (name === "Unknown") continue;

    const addr = (cols[iAddr] ?? "").trim();
    const mun = (cols[iMun] ?? "").trim();
    const postal = formatPostalCode((cols[iPostal] ?? "").trim());
    const address = [addr, mun ? `${mun}, QC` : "", postal]
      .filter(Boolean)
      .join(", ");

    const type: FacilityRecord["type"] = isHospital ? "hospital" : "clsc";

    facilities.push({
      name,
      type,
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

export async function fetchErData(): Promise<Map<string, ParsedErRow>> {
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

// ── Pharmacies & Clinics (Overpass / OpenStreetMap) ──────────────────────────
// Single combined query to avoid Overpass rate-limiting.

const POI_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const poiCache = new Map<string, { pharmacies: FacilityRecord[]; clinics: FacilityRecord[]; at: number }>();
const pharmacyPhones = new Map<string, string>();
const clinicPhones = new Map<string, string>();

interface OverpassElement {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function buildPOIAddress(tags: Record<string, string>): string {
  const parts: string[] = [];
  const num = tags["addr:housenumber"];
  const street = tags["addr:street"];
  if (num && street) parts.push(`${num} ${street}`);
  else if (street) parts.push(street);
  const city = tags["addr:city"];
  if (city) parts.push(`${city}, QC`);
  const postal = tags["addr:postcode"];
  if (postal) parts.push(formatPostalCode(postal));
  return parts.join(", ");
}

function parseOverpassPOIs(
  elements: OverpassElement[],
  userLat: number,
  userLng: number
): { pharmacies: FacilityRecord[]; clinics: FacilityRecord[] } {
  const seenPharm = new Set<string>();
  const seenClinic = new Set<string>();
  const pharmacies: FacilityRecord[] = [];
  const clinics: FacilityRecord[] = [];

  for (const el of elements) {
    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (!elLat || !elLng) continue;

    const tags = el.tags ?? {};
    const isPharmacy =
      tags.amenity === "pharmacy" ||
      tags.shop === "chemist" ||
      tags.healthcare === "pharmacy";

    const dedupKey = `${elLat.toFixed(4)},${elLng.toFixed(4)}`;

    if (isPharmacy) {
      if (seenPharm.has(dedupKey)) continue;
      seenPharm.add(dedupKey);
      const name = sanitizeFacilityName(tags.name || tags.brand || "Pharmacy");
      const address = buildPOIAddress(tags);
      if (tags.phone) pharmacyPhones.set(`${name}|${elLat.toFixed(5)}`, sanitizePhone(tags.phone));
      pharmacies.push({ name, type: "pharmacy", address, region: "", lat: elLat, lng: elLng });
    } else {
      if (seenClinic.has(dedupKey)) continue;
      seenClinic.add(dedupKey);
      const name = sanitizeFacilityName(tags.name || tags["name:fr"] || "Clinique");
      const address = buildPOIAddress(tags);
      if (tags.phone) clinicPhones.set(`${name}|${elLat.toFixed(5)}`, sanitizePhone(tags.phone));
      clinics.push({ name, type: "clinic", address, region: "", lat: elLat, lng: elLng });
    }
  }

  const dist = (f: FacilityRecord) => haversineKm(userLat, userLng, f.lat, f.lng);
  pharmacies.sort((a, b) => dist(a) - dist(b));
  clinics.sort((a, b) => dist(a) - dist(b));
  return { pharmacies, clinics };
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function queryOverpass(query: string): Promise<{ elements: OverpassElement[] }> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.status === 429) {
        console.warn(`[healthHelp] Overpass 429 from ${endpoint}, trying next…`);
        continue;
      }
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      return (await res.json()) as { elements: OverpassElement[] };
    } catch (err) {
      console.warn(`[healthHelp] Overpass error from ${endpoint}:`, err);
    }
  }
  throw new Error("All Overpass endpoints failed");
}

async function fetchNearbyPOIs(
  lat: number,
  lng: number
): Promise<{ pharmacies: FacilityRecord[]; clinics: FacilityRecord[] }> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const now = Date.now();
  const cached = poiCache.get(key);
  if (cached && now - cached.at < POI_CACHE_TTL) {
    return cached;
  }

  try {
    // Fetch pharmacies first
    const pharmQuery = `[out:json][timeout:20];(
      node[amenity=pharmacy](around:25000,${lat},${lng});
      way[amenity=pharmacy](around:25000,${lat},${lng});
      node[shop=chemist](around:25000,${lat},${lng});
      node[healthcare=pharmacy](around:25000,${lat},${lng});
    );out center 30;`;

    const pharmData = await queryOverpass(pharmQuery);

    // Then fetch clinics (sequential to avoid rate-limiting)
    const clinicQuery = `[out:json][timeout:20];(
      node[amenity=clinic](around:25000,${lat},${lng});
      way[amenity=clinic](around:25000,${lat},${lng});
      node[healthcare=clinic](around:25000,${lat},${lng});
      way[healthcare=clinic](around:25000,${lat},${lng});
      node[healthcare=doctor](around:25000,${lat},${lng});
      way[healthcare=doctor](around:25000,${lat},${lng});
    );out center 30;`;

    const clinicData = await queryOverpass(clinicQuery);

    const pharmacies = parseOverpassPOIs(pharmData.elements, lat, lng).pharmacies;
    const clinics = parseOverpassPOIs(clinicData.elements, lat, lng).clinics;

    const result = { pharmacies, clinics };
    poiCache.set(key, { ...result, at: now });
    console.log(`[healthHelp] Overpass OK: ${pharmacies.length} pharmacies, ${clinics.length} clinics`);
    return result;
  } catch (err) {
    console.warn("[healthHelp] Overpass fetch failed:", err);
    return cached ?? { pharmacies: [], clinics: [] };
  }
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

      // Fetch CSV facilities, ER data, and Overpass POIs in parallel
      const [allFacilities, erMap, pois] = await Promise.all([
        fetchFacilities(),
        fetchErData(),
        fetchNearbyPOIs(lat, lng),
      ]);

      console.log("[healthHelp] nearestFacilities query:", {
        perType,
        csvFacilities: allFacilities.length,
        pharmacies: pois.pharmacies.length,
        clinics: pois.clinics.length,
      });

      // Promote any facility that has ER data to "hospital"
      const promoted = allFacilities.map((h: FacilityRecord) => {
        if (h.type === "hospital") return h;
        const key = h.name.toUpperCase().trim();
        if (erMap.has(key)) return { ...h, type: "hospital" as const };
        return h;
      });

      // Compute distances for hospitals/CLSCs
      const withDistance = promoted.map((h: FacilityRecord) => ({
        ...h,
        distanceKm:
          Math.round(haversineKm(lat, lng, h.lat, h.lng) * 10) / 10,
      }));
      withDistance.sort((a: { distanceKm: number }, b: { distanceKm: number }) => a.distanceKm - b.distanceKm);

      // Pick N nearest hospitals + N nearest CLSCs
      const hospitals = withDistance.filter((h: FacilityRecord) => h.type === "hospital").slice(0, perType);
      const clscs = withDistance.filter((h: FacilityRecord) => h.type === "clsc").slice(0, perType);

      // Clinics & pharmacies from Overpass (already sorted by distance)
      const clinicResults = pois.clinics.slice(0, perType).map((c) => ({
        ...c,
        distanceKm: Math.round(haversineKm(lat, lng, c.lat, c.lng) * 10) / 10,
      }));
      const pharmacyResults = pois.pharmacies.slice(0, perType).map((p) => ({
        ...p,
        distanceKm: Math.round(haversineKm(lat, lng, p.lat, p.lng) * 10) / 10,
      }));

      const nearest = [...hospitals, ...clscs, ...clinicResults, ...pharmacyResults].sort(
        (a, b) => a.distanceKm - b.distanceKm
      );

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
          msssName: h.type === "pharmacy" || h.type === "clinic" ? `${h.name}|${h.lat},${h.lng}` : h.name,
          nameFr: h.name,
          nameEn: h.name,
          type: h.type,
          address: h.address,
          lat: h.lat,
          lng: h.lng,
          region: h.region,
          phone: phoneBook.get(key) ?? pharmacyPhones.get(`${h.name}|${h.lat.toFixed(5)}`) ?? clinicPhones.get(`${h.name}|${h.lat.toFixed(5)}`) ?? "",
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

  // ── Favorites ────────────────────────────────────────────────────────────

  addFavorite: protectedProcedure
    .input(z.object({ facilityName: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(erFavorite)
        .values({ userId: ctx.user.id, facilityName: input.facilityName })
        .onConflictDoNothing();
      return { added: true };
    }),

  removeFavorite: protectedProcedure
    .input(z.object({ facilityName: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(erFavorite)
        .where(and(eq(erFavorite.userId, ctx.user.id), eq(erFavorite.facilityName, input.facilityName)));
      return { removed: true };
    }),

  listFavorites: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({ facilityName: erFavorite.facilityName })
        .from(erFavorite)
        .where(eq(erFavorite.userId, ctx.user.id));
      return rows.map((r) => r.facilityName);
    }),

  // ── History & Analytics ──────────────────────────────────────────────────

  facilityHistory: protectedProcedure
    .input(z.object({
      facilityName: z.string().min(1).max(200),
      range: z.enum(["24h", "7d", "30d"]),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const from = new Date(now);
      if (input.range === "24h") from.setHours(from.getHours() - 24);
      else if (input.range === "7d") from.setDate(from.getDate() - 7);
      else from.setDate(from.getDate() - 30);

      return ctx.db
        .select({
          snapshotAt: erSnapshot.snapshotAt,
          occupancyRate: erSnapshot.occupancyRate,
          patientsWaiting: erSnapshot.patientsWaiting,
          avgWaitHours: erSnapshot.avgWaitHours,
        })
        .from(erSnapshot)
        .where(and(
          eq(erSnapshot.facilityName, input.facilityName),
          gte(erSnapshot.snapshotAt, from),
        ))
        .orderBy(erSnapshot.snapshotAt)
        .limit(2000);
    }),

  compareFacilities: protectedProcedure
    .input(z.object({
      facilityNames: z.array(z.string().min(1)).min(1).max(5),
    }))
    .query(async ({ ctx, input }) => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const results = await Promise.all(input.facilityNames.map(async (name) => {
        // Latest snapshot
        const [latest] = await ctx.db
          .select()
          .from(erSnapshot)
          .where(eq(erSnapshot.facilityName, name))
          .orderBy(desc(erSnapshot.snapshotAt))
          .limit(1);

        // 7-day averages
        const [avgs] = await ctx.db
          .select({
            avgOccupancy: avg(erSnapshot.occupancyRate),
            avgWait: avg(erSnapshot.avgWaitHours),
            avgPatientsWaiting: avg(erSnapshot.patientsWaiting),
          })
          .from(erSnapshot)
          .where(and(
            eq(erSnapshot.facilityName, name),
            gte(erSnapshot.snapshotAt, sevenDaysAgo),
          ));

        return {
          facilityName: name,
          current: latest ? {
            occupancyRate: latest.occupancyRate,
            patientsWaiting: latest.patientsWaiting,
            avgWaitHours: latest.avgWaitHours,
            stretcherCount: latest.stretcherCount,
            stretchersOccupied: latest.stretchersOccupied,
            snapshotAt: latest.snapshotAt,
          } : null,
          avg7d: {
            occupancy: avgs?.avgOccupancy ? Math.round(Number(avgs.avgOccupancy)) : null,
            waitHours: avgs?.avgWait ? Math.round(Number(avgs.avgWait) * 10) / 10 : null,
            patientsWaiting: avgs?.avgPatientsWaiting ? Math.round(Number(avgs.avgPatientsWaiting)) : null,
          },
        };
      }));

      return results;
    }),

  bestTimeToVisit: protectedProcedure
    .input(z.object({ facilityName: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      // Aggregate by day-of-week (0=Sun..6=Sat) and hour (0-23)
      const rows = await ctx.db
        .select({
          dow: sql<number>`EXTRACT(DOW FROM ${erSnapshot.snapshotAt})::int`,
          hour: sql<number>`EXTRACT(HOUR FROM ${erSnapshot.snapshotAt})::int`,
          avgOccupancy: avg(erSnapshot.occupancyRate),
        })
        .from(erSnapshot)
        .where(eq(erSnapshot.facilityName, input.facilityName))
        .groupBy(
          sql`EXTRACT(DOW FROM ${erSnapshot.snapshotAt})`,
          sql`EXTRACT(HOUR FROM ${erSnapshot.snapshotAt})`,
        );

      // Build 7x24 grid (default null for missing data)
      const grid: (number | null)[][] = Array.from({ length: 7 }, () =>
        Array.from({ length: 24 }, () => null)
      );

      for (const row of rows) {
        const d = Number(row.dow);
        const h = Number(row.hour);
        grid[d]![h] = row.avgOccupancy ? Math.round(Number(row.avgOccupancy)) : null;
      }

      return grid;
    }),
});
