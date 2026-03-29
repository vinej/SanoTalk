import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
      host: '0.0.0.0'
  },
  test: {
    globals: true,
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test_db",
      NODE_ENV: "test",
    },
  },
});
