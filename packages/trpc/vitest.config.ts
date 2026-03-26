import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      // Prevents @sanotalk/db client from throwing at import time
      DATABASE_URL: "postgresql://test:test@localhost:5432/test_db",
    },
  },
});
