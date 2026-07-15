import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const MAP_ID = "1TbtYyvz6fS9qpn43ZbrWi6NnRYDaVXs";
const KML_URL = `https://www.google.com/maps/d/kml?mid=${MAP_ID}&forcekml=1`;
const outputPath = process.argv[2] ?? "github-pages/public/data/places.json";
const cachePath = process.argv[3] ?? "github-pages/public/data/places-cache.json";

function decodeXml(value) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code.replace(/^x/i, ""), /^x/i.test(code) ? 16 : 10)),
    )
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity)
    .trim();
}

function tag(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decodeXml(match?.[1] ?? "");
}

function cleanDescription(html) {
  return decodeXml(html)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function categoryFor(name, description, layer) {
  const text = `${layer} ${name} ${description}`;
  if (/神社|観音堂|地蔵|寺|本宮/.test(text)) return "神社";
  if (/美術館|陶磁器|ギャラリー|蘭島閣/.test(text)) return "美術館";
  if (/食堂|cafe|カフェ|グルメ|海駅|レストラン|ストアー/.test(text)) return "グルメ";
  if (/公園|海水浴場|キャンプ|芝生|遊具/.test(text)) return "公園";
  if (/住居|御本陣|松濤園|伝説|伝統|歴史|石畳|雁木|NEWS/.test(text)) return "歴史";
  return "絶景";
}

function stableId(name, lat, lng) {
  const input = `${name}|${lat.toFixed(6)}|${lng.toFixed(6)}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `mymaps-${(hash >>> 0).toString(36)}`;
}

function parsePlacemark(block, layer) {
  const coordinates = tag(block, "coordinates").split(",").map(Number);
  if (coordinates.length < 2 || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) return null;
  const [lng, lat] = coordinates;
  const name = tag(block, "name") || "名称未設定スポット";
  const descriptionHtml = tag(block, "description");
  const decodedHtml = decodeXml(descriptionHtml);
  const photoUrl = decodedHtml.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  const youtubeId = decodedHtml.match(/(?:youtube\.com\/(?:watch\?[^"'\s>]*v=|embed\/)|youtu\.be\/)([\w-]{6,})/i)?.[1];
  const description = cleanDescription(descriptionHtml);
  return {
    id: stableId(name, lat, lng),
    name,
    category: categoryFor(name, description, layer),
    lat,
    lng,
    description,
    image: photoUrl,
    photoUrl,
    youtube: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : undefined,
    sourceLayer: layer,
  };
}

function parseMyMapsKml(kml) {
  const places = [];
  const covered = new Set();
  const folders = [...kml.matchAll(/<Folder(?:\s[^>]*)?>([\s\S]*?)<\/Folder>/gi)];
  for (const folderMatch of folders) {
    const folder = folderMatch[1];
    const layer = tag(folder, "name");
    for (const match of folder.matchAll(/<Placemark(?:\s[^>]*)?>([\s\S]*?)<\/Placemark>/gi)) {
      const place = parsePlacemark(match[1], layer);
      if (place && !covered.has(place.id)) {
        covered.add(place.id);
        places.push(place);
      }
    }
  }
  for (const match of kml.matchAll(/<Placemark(?:\s[^>]*)?>([\s\S]*?)<\/Placemark>/gi)) {
    const place = parsePlacemark(match[1], "Google マイマップ");
    if (place && !covered.has(place.id)) {
      covered.add(place.id);
      places.push(place);
    }
  }
  return places;
}

function checksum(input) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash, 33) ^ input.charCodeAt(index);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

await mkdir(dirname(outputPath), { recursive: true });

try {
  const response = await fetch(KML_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Googleマイマップ取得エラー (${response.status})`);
  const kml = await response.text();
  const places = parseMyMapsKml(kml);
  if (!places.length) throw new Error("Googleマイマップに有効なスポットがありません");
  const body = {
    places,
    source: "Google My Maps",
    updatedAt: new Date().toISOString(),
    spotCount: places.length,
    sourceHash: checksum(kml),
    cached: false,
  };
  const json = `${JSON.stringify(body, null, 2)}\n`;
  await writeFile(outputPath, json, "utf8");
  if (process.env.SYNC_WRITE_CACHE === "1") await writeFile(cachePath, json, "utf8");
  console.log(`Synced ${places.length} spots from Google My Maps.`);
} catch (error) {
  const cached = JSON.parse(await readFile(cachePath, "utf8"));
  cached.cached = true;
  cached.syncError = error instanceof Error ? error.message : "Googleマイマップの同期に失敗しました";
  await writeFile(outputPath, `${JSON.stringify(cached, null, 2)}\n`, "utf8");
  console.warn(`Sync failed; published cached data: ${cached.syncError}`);
}
