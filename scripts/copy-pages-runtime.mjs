import { copyFile, mkdir } from "node:fs/promises";

await mkdir("pages-dist/data", { recursive: true });
await copyFile("github-pages/public/runtime-config.js", "pages-dist/runtime-config.js");
await copyFile("github-pages/public/data/places.json", "pages-dist/data/places.json");
