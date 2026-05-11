import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "/analyzer/",
  build: {
    outDir: "../static/analyzer",
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      input: {
        analyzer: resolve(__dirname, "analyzer.html"),
      },
    },
  },
});
