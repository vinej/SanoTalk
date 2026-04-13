import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const apiTarget = env.VITE_API_URL || "http://localhost:3001";
  const wsTarget = env.VITE_WS_URL || "ws://localhost:3001";

  return {
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  server: {
    allowedHosts: ["localhost", "sanotalk.com", "www.sanotalk.com", "api.sanotalk.com"],
    port: 5178,
    host: true,
    hmr: {
      host: "localhost",
      port: 5178,
    },
    headers: {
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",   // Vite injects inline HMR scripts
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https://*.tile.openstreetmap.org https://api.dicebear.com https://avatars.dicebear.com https://www.gravatar.com",
        "font-src 'self'",
        "connect-src 'self' ws://localhost:* wss://localhost:* wss://*.livekit.cloud https://api.nal.usda.gov https://www.themealdb.com https://rxnav.nlm.nih.gov https://api.fda.gov",
        "media-src 'self'",
        "worker-src 'self'",
        "frame-src 'none'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
      "Cross-Origin-Opener-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(self), payment=()",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
      "/ws": {
        target: wsTarget,
        ws: true,
      },
    },
  },
  };
});
