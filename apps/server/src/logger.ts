import pino from "pino";

const lokiUrl = process.env.LOKI_URL;

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
      // Redact known PII keys entirely
      if (k === "email" || k === "password") {
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
