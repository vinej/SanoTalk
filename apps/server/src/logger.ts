import pino from "pino";
import PinoLoki from "pino-loki";

const lokiUrl = process.env.LOKI_URL;

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
  },
  transport
);
