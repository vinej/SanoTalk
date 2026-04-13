import { logger } from "../logger";

const TERRA_BASE = "https://api.tryterra.co/v2";

function headers(): Record<string, string> {
  const apiKey = process.env.TERRA_API_KEY;
  const devId = process.env.TERRA_DEV_ID;
  if (!apiKey || !devId) throw new Error("Terra credentials not configured");
  return {
    "x-api-key": apiKey,
    "dev-id": devId,
    "Content-Type": "application/json",
  };
}

/**
 * Generate a hosted-widget OAuth session for the user. The returned URL is
 * shown in a popup; once the user completes vendor consent, Terra issues an
 * `auth` webhook back to /api/webhooks/terra carrying our `reference_id`.
 */
export async function generateWidgetSession(args: {
  referenceId: string;
  providers?: string[];
  language?: string;
  authSuccessRedirectUrl?: string;
  authFailureRedirectUrl?: string;
}): Promise<{ url: string; sessionId: string; expiresAt: number }> {
  const body = {
    reference_id: args.referenceId,
    providers: (args.providers ?? ["GARMIN", "FITBIT", "GOOGLE"]).join(","),
    language: args.language ?? "EN",
    auth_success_redirect_url: args.authSuccessRedirectUrl,
    auth_failure_redirect_url: args.authFailureRedirectUrl,
  };
  const res = await fetch(`${TERRA_BASE}/auth/generateWidgetSession`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error({ status: res.status, text }, "Terra generateWidgetSession failed");
    throw new Error(`Terra widget session failed: ${res.status}`);
  }
  const json = (await res.json()) as { url: string; session_id: string; expires_in: number };
  return {
    url: json.url,
    sessionId: json.session_id,
    expiresAt: Date.now() + (json.expires_in ?? 900) * 1000,
  };
}

export interface TerraDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  toWebhook?: boolean;
}

async function getResource(resource: "body" | "daily" | "activity", terraUserId: string, range: TerraDateRange) {
  const params = new URLSearchParams({
    user_id: terraUserId,
    start_date: range.startDate,
    end_date: range.endDate,
    to_webhook: String(range.toWebhook ?? false),
  });
  const res = await fetch(`${TERRA_BASE}/${resource}?${params.toString()}`, {
    method: "GET",
    headers: headers(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.warn({ resource, status: res.status, text }, "Terra resource fetch failed");
    throw new Error(`Terra ${resource} fetch failed: ${res.status}`);
  }
  return (await res.json()) as { data: unknown[] };
}

export const getBody = (terraUserId: string, range: TerraDateRange) => getResource("body", terraUserId, range);
export const getDaily = (terraUserId: string, range: TerraDateRange) => getResource("daily", terraUserId, range);
export const getActivity = (terraUserId: string, range: TerraDateRange) => getResource("activity", terraUserId, range);

/**
 * Revoke Terra's connection on the vendor side. Safe to call even when the
 * connection is already revoked; Terra returns 200 in that case.
 */
export async function deauthUser(terraUserId: string): Promise<void> {
  const res = await fetch(`${TERRA_BASE}/auth/deauthenticateUser?user_id=${encodeURIComponent(terraUserId)}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => "");
    logger.warn({ terraUserId, status: res.status, text }, "Terra deauth failed");
    throw new Error(`Terra deauth failed: ${res.status}`);
  }
}
