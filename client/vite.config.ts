import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Mobile-first dev: host on 0.0.0.0 so you can open it from your phone on the
// same Wi-Fi. The shared package is consumed as raw TS from the workspace.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  optimizeDeps: {
    exclude: ["@cambio/shared"],
  },
});
