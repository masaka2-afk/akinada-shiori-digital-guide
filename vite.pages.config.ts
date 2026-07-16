import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "akinada-shiori-digital-guide";
const base = process.env.PAGES_BASE_PATH ?? `/${repository}/`;

export default defineConfig({
  root: "github-pages",
  base,
  publicDir: "../public",
  plugins: [react()],
  build: {
    outDir: "../pages-dist",
    emptyOutDir: true,
  },
});
