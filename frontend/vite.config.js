import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Custom plugin to handle util module for simple-peer
const handleUtilPlugin = {
  name: "handle-util-module",
  enforce: "pre",
  resolveId(id) {
    if (id === "util") {
      return this.resolve("util");
    }
  },
  transform(code, id) {
    // Suppress console warnings from simple-peer trying to use Node.js utils
    if (id.includes("simple-peer")) {
      // Replace debuglog calls with no-op function
      let transformed = code.replace(
        /util\.debuglog\([^)]*\)/g,
        "(() => () => {})()",
      );
      // Replace util.inspect calls with JSON.stringify fallback
      transformed = transformed.replace(/util\.inspect\(/g, "JSON.stringify(");
      if (transformed !== code) {
        return {
          code: transformed,
          map: null,
        };
      }
    }
  },
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const backendTarget = (env.VITE_API_URL || "http://127.0.0.1:8080/api")
    .replace(/\/api\/?$/, "")
    .replace(/\/$/, "");

  return {
    plugins: [handleUtilPlugin, react()],
    server: {
      host: "0.0.0.0",
      port: 5174,
      allowedHosts: [
        "localhost",
        "127.0.0.1",
        ".loca.lt",
        ".trycloudflare.com",
      ],
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        "/ws": {
          target: backendTarget,
          changeOrigin: true,
          ws: true,
          secure: false,
        },
        "/ws-telemedicine": {
          target: backendTarget,
          changeOrigin: true,
          ws: true,
          secure: false,
        },
        "/ws-telemedicine-native": {
          target: backendTarget,
          changeOrigin: true,
          ws: true,
          secure: false,
        },
      },
    },
    preview: {
      host: "0.0.0.0",
    },
    define: {
      global: "globalThis",
      "process.env": {},
    },
    resolve: {
      alias: {
        events: "events",
        process: "process/browser",
        buffer: "buffer",
      },
      fallback: {
        util: "util",
        stream: false,
        crypto: false,
      },
    },
    optimizeDeps: {
      include: ["simple-peer", "events", "buffer", "process", "util"],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
  };
});
