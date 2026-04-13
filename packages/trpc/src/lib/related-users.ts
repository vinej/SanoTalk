import { eq, or, and } from "drizzle-orm";
import { userLink, userFriend, connectionRequest } from "@sanotalk/db";
import type { protectedProcedure } from "../trcp";

type DB = Parameters<Parameters<typeof protectedProcedure.query>[0]>[0]["ctx"]["db"];

/**
 * Returns the set of user IDs that `userId` has a relationship with:
 * linked professionals/patients, friends, and (by default) pending connection requests.
 *
 * Pass `{ acceptedOnly: true }` to restrict the result to established relationships
 * only — e.g. for Kanban task assignment, where a user may only assign tasks to
 * people already in their profile (Doctor / Wellness / Pharmacist / Friends) and
 * not to people with only a pending connection request.
 */
export async function getRelatedUserIds(
  db: DB,
  userId: string,
  options: { acceptedOnly?: boolean } = {}
): Promise<Set<string>> {
  const ids = new Set<string>();

  // Professional links (patient ↔ doctor/pharmacist/wellness)
  const links = await db
    .select({ patientId: userLink.patientId, professionalId: userLink.professionalId })
    .from(userLink)
    .where(or(eq(userLink.patientId, userId), eq(userLink.professionalId, userId)));
  for (const l of links) {
    ids.add(l.patientId);
    ids.add(l.professionalId);
  }

  // Friends
  const friends = await db
    .select({ friendId: userFriend.friendId })
    .from(userFriend)
    .where(eq(userFriend.userId, userId));
  for (const f of friends) {
    ids.add(f.friendId);
  }

  if (!options.acceptedOnly) {
    // Pending connection requests (both directions — so the user can still
    // see people they've sent requests to or received requests from)
    const requests = await db
      .select({ fromUserId: connectionRequest.fromUserId, toUserId: connectionRequest.toUserId })
      .from(connectionRequest)
      .where(
        and(
          or(eq(connectionRequest.fromUserId, userId), eq(connectionRequest.toUserId, userId)),
          eq(connectionRequest.status, "pending")
        )
      );
    for (const r of requests) {
      ids.add(r.fromUserId);
      ids.add(r.toUserId);
    }
  }

  // Remove self
  ids.delete(userId);

  return ids;
}
