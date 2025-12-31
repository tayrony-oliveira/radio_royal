import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const owncastUrl = process.env.VITE_OWNCAST_WEB_URL || "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: owncastUrl,
        changeOrigin: true
      },
      "/hls": {
        target: owncastUrl,
        changeOrigin: true
      }
    }
  }
});
