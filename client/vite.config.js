import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import process from "node:process";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/robots.txt": { target: `http://127.0.0.1:${process.env.PORT || 3001}`, changeOrigin: false },
      "/challenge-assets": { target: `http://127.0.0.1:${process.env.PORT || 3001}`, changeOrigin: false },
      "/api": {
        target: `http://127.0.0.1:${process.env.PORT || 3001}`,
        changeOrigin: false,
      },
    },
  },
});
