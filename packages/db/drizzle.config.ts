import { type Config } from "drizzle-kit";

export default {
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: 'postgresql://postgres:REDACTED@localhost:5432/sanotalk',
  },
  tablesFilter: ["sanotalk_*"],
  out: "./drizzle",
} satisfies Config;
