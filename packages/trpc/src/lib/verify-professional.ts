import { user } from "@sanotalk/db";
import { eq } from "drizzle-orm";
import type { protectedProcedure } from "../trcp";

type DB = Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"];

/**
 * Re-fetches the user's role from the database to verify professional status.
 * Returns true if the user is a doctor or pharmacist.
 */
export async function verifyProfessionalFromDb(db: DB, userId: string): Promise<boolean> {
  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { role: true },
  });
  return row?.role === "doctor" || row?.role === "pharmacist";
}
