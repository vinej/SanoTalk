import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    include: ["@deepgram/sdk"]
  }
});