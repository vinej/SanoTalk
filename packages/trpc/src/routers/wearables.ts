import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trcp";
import { wearableConnection } from "@sanotalk/db";
import { eq, and, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const PROVIDER_ENUM = z.enum(["GARMIN", "FITBIT", "GOOGLE"]);

const TERRA_BASE = "https://api.tryterra.co/v2";

interface TerraWidgetResponse {
  url: string;
  session_id: string;
  expires_in: number;
}

export const wearablesRouter = createTRPCRouter({
  listConnections: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: wearableConnection.id,
        provider: wearableConnection.provider,
        status: wearableConnection.status,
        connectedAt: wearableConnection.connectedAt,
        lastSyncedAt: wearableConnection.lastSyncedAt,
        lastErrorAt: wearableConnection.lastErrorAt,
      })
      .from(wearableConnection)
      .where(eq(wearableConnection.userId, ctx.user.id))
      .orderBy(desc(wearableConnection.connectedAt));
    return rows;
  }),

  createConnectSession: protectedProcedure
    .input(z.object({ providers: z.array(PROVIDER_ENUM).optional() }))
    .mutation(async ({ ctx, input }) => {
      const apiKey = process.env.TERRA_API_KEY;
      const devId = process.env.TERRA_DEV_ID;
      if (!apiKey || !devId) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Wearable integration is not configured on this server" });
      }

      const appUrl = process.env.APP_URL ?? "";

      // reference_id MUST be the authenticated user — never a client-supplied value.
      const body = {
        reference_id: ctx.user.id,
        providers: (input.providers ?? ["GARMIN", "FITBIT", "GOOGLE"]).join(","),
        language: "EN",
        auth_success_redirect_url: appUrl ? `${appUrl}/vitals?wearable=connected` : undefined,
        auth_failure_redirect_url: appUrl ? `${appUrl}/vitals?wearable=failed` : undefined,
      };

      const res = await fetch(`${TERRA_BASE}/auth/generateWidgetSession`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "dev-id": devId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: `Terra widget session failed (${res.status})` });
      }
      const json = (await res.json()) as TerraWidgetResponse;
      return {
        url: json.url,
        sessionId: json.session_id,
        expiresAt: Date.now() + (json.expires_in ?? 900) * 1000,
      };
    }),

  disconnect: protectedProcedure
    .input(z.object({ connectionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const conn = await ctx.db.query.wearableConnection.findFirst({
        where: and(
          eq(wearableConnection.id, input.connectionId),
          eq(wearableConnection.userId, ctx.user.id),
        ),
      });
      if (!conn) throw new TRPCError({ code: "NOT_FOUND" });

      const apiKey = process.env.TERRA_API_KEY;
      const devId = process.env.TERRA_DEV_ID;
      if (apiKey && devId) {
        // Best-effort: revoke on Terra's side. A failure here shouldn't block
        // the local delete — the user wants this gone.
        try {
          await fetch(`${TERRA_BASE}/auth/deauthenticateUser?user_id=${encodeURIComponent(conn.terraUserId)}`, {
            method: "DELETE",
            headers: { "x-api-key": apiKey, "dev-id": devId },
          });
        } catch {
          // swallow — we still delete locally
        }
      }

      await ctx.db
        .delete(wearableConnection)
        .where(and(
          eq(wearableConnection.id, input.connectionId),
          eq(wearableConnection.userId, ctx.user.id),
        ));
      return { deleted: true };
    }),
});
