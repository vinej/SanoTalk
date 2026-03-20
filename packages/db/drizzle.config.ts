import { type Config } from "drizzle-kit";

export default {
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  tablesFilter: ["sanotalk_*"],
  out: "./drizzle",
} satisfies Config;
