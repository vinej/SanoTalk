import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // DB tests require a real DATABASE_URL — set it in .env.test
    // Run with: DATABASE_URL=postgresql://... pnpm test
  },
});
