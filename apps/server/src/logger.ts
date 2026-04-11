import pino from "pino";

// Validate LOKI_URL to prevent log exfiltration to arbitrary endpoints
const rawLokiUrl = process.env.LOKI_URL;
let lokiUrl: string | undefined;
if (rawLokiUrl) {
  try {
    const parsed = new URL(rawLokiUrl);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      lokiUrl = rawLokiUrl;
    } else {
      console.error(`[logger] LOKI_URL has invalid protocol: ${parsed.protocol} — ignoring`);
    }
  } catch {
    console.error("[logger] LOKI_URL is not a valid URL — ignoring");
  }
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Redact emails and truncate UUIDs in log values. */
function scrubPii(obj: unknown): unknown {
  if (typeof obj === "string") {
    return obj.replace(EMAIL_RE, (m) => m.slice(0, 3) + "***");
  }
  if (Array.isArray(obj)) return obj.map(scrubPii);
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      // Redact known PII/secret keys entirely
      if (["email", "password", "token", "accessToken", "refreshToken", "idToken", "otp", "secret", "backupCodes"].includes(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = scrubPii(v);
      }
    }
    return out;
  }
  return obj;
}

const transport =
  process.env.NODE_ENV === "production" && lokiUrl
    ? pino.transport({
        targets: [
          {
            target: "pino/file",
            options: { destination: 1 }, // stdout
          },
          {
            target: "pino-loki",
            options: {
              host: lokiUrl,
              labels: { app: "sanotalk-server" },
              batching: true,
              interval: 5,
              headers: { "X-Scope-OrgID": "sanotalk" },
            },
          },
        ],
      })
    : pino.transport({
        target: "pino-pretty",
        options: { colorize: true },
      });

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: { app: "sanotalk-server", env: process.env.NODE_ENV ?? "development" },
    redact: {
      paths: ["email", "*.email", "req.headers.cookie", "req.headers.authorization"],
      censor: "[redacted]",
    },
    formatters: {
      log(bindings) {
        return scrubPii(bindings) as Record<string, unknown>;
      },
    },
  },
  transport
);
