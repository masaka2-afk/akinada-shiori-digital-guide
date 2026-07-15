import { mkdir, writeFile } from "node:fs/promises";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "akinada-shiori-digital-guide-beta";
const basePath = (process.env.PAGES_BASE_PATH ?? `/${repository}`).replace(/\/$/, "");
const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
const mapId = process.env.GOOGLE_MAPS_MAP_ID?.trim() ?? "";

if (!apiKey) throw new Error("GOOGLE_MAPS_API_KEY is required for the GitHub Pages build.");

const config = {
  apiKey,
  mapId,
  basePath,
  placesUrl: `${basePath}/data/places.json`,
};

await mkdir("github-pages/public", { recursive: true });
await writeFile(
  "github-pages/public/runtime-config.js",
  `window.__AKINADA_STATIC_CONFIG__ = ${JSON.stringify(config).replaceAll("<", "\\u003c")};\n`,
  "utf8",
);
