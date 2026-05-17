import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const isBuild = process.argv.includes("build");

export default defineConfig({
  plugins: [react()],
  base: isBuild ? "/landing/" : "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../static/landing"),
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        login: path.resolve(__dirname, "login.html"),
      },
    },
  },
});
