import { fetchErData } from "../routers/healthHelp";
import { erSnapshot } from "@sanotalk/db";
import { lt } from "drizzle-orm";

type DB = Parameters<typeof erSnapshot.$inferSelect extends never ? never : any>[0] extends never
  ? any
  : any;

/**
 * Snapshots current ER data into the er_snapshot table.
 * Called every 30 minutes by setInterval in the server entry point.
 * Also cleans up rows older than 90 days.
 */
export async function snapshotErData(db: any): Promise<void> {
  try {
    const erMap = await fetchErData();
    if (erMap.size === 0) return;

    const rows = Array.from(erMap.values()).map((row) => {
      const occupancyRate = row.stretcherCount > 0
        ? Math.round((row.stretchersOccupied / row.stretcherCount) * 100)
        : null;

      return {
        facilityName: row.facilityName,
        occupancyRate,
        patientsWaiting: row.patientsWaiting,
        avgWaitHours: row.avgAmbulatoryStayHours,
        stretcherCount: row.stretcherCount,
        stretchersOccupied: row.stretchersOccupied,
        patientsOver24h: row.patientsOver24h,
        patientsOver48h: row.patientsOver48h,
      };
    });

    if (rows.length > 0) {
      await db.insert(erSnapshot).values(rows);
    }

    // Clean up rows older than 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    await db.delete(erSnapshot).where(lt(erSnapshot.snapshotAt, cutoff));
  } catch {
    // Swallow errors silently — ER snapshot is best-effort background work.
    // Do not use console.error here as it bypasses PII scrubbing in the pino logger.
  }
}
