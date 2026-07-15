import { env } from "cloudflare:workers";

const MAP_ID = "1TbtYyvz6fS9qpn43ZbrWi6NnRYDaVXs";
const KML_URL = `https://www.google.com/maps/d/kml?mid=${MAP_ID}&forcekml=1`;
const CACHE_ID = "akinada-shiori-primary-map";
const CACHE_MAX_AGE_MS = 15 * 60 * 1000;

export type PlaceRecord = {
  id: string;
  name: string;
  category: "絶景" | "歴史" | "神社" | "グルメ" | "公園" | "美術館";
  lat: number;
  lng: number;
  description: string;
  image?: string;
  photoUrl?: string;
  youtube?: string;
  sourceLayer?: string;
};

type CacheRow = {
  payload: string;
  synced_at: string;
  spot_count: number;
  source_hash: string;
  last_error: string | null;
};

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS map_sync_cache (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  spot_count INTEGER NOT NULL,
  source_hash TEXT NOT NULL,
  last_error TEXT
)`;

function database() {
  try {
    return env.DB as D1Database | undefined;
  } catch {
    return undefined;
  }
}

async function ensureCacheTable(db: D1Database) {
  await db.prepare(CREATE_TABLE).run();
}

async function readCache(db?: D1Database) {
  if (!db) return null;
  await ensureCacheTable(db);
  return db.prepare(
    "SELECT payload, synced_at, spot_count, source_hash, last_error FROM map_sync_cache WHERE id = ?",
  ).bind(CACHE_ID).first<CacheRow>();
}

async function writeCache(db: D1Database, places: PlaceRecord[], syncedAt: string, hash: string) {
  await ensureCacheTable(db);
  await db.prepare(`INSERT INTO map_sync_cache (id, payload, synced_at, spot_count, source_hash, last_error)
    VALUES (?, ?, ?, ?, ?, NULL)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, synced_at = excluded.synced_at,
    spot_count = excluded.spot_count, source_hash = excluded.source_hash, last_error = NULL`).bind(
    CACHE_ID,
    JSON.stringify(places),
    syncedAt,
    places.length,
    hash,
  ).run();
}

async function rememberError(db: D1Database | undefined, message: string) {
  if (!db) return;
  await ensureCacheTable(db);
  await db.prepare("UPDATE map_sync_cache SET last_error = ? WHERE id = ?").bind(message, CACHE_ID).run();
}

function decodeXml(value: string) {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  };
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code.replace(/^x/i, ""), /^x/i.test(code) ? 16 : 10)),
    )
    .replace(/&([a-z]+);/gi, (entity, name: string) => named[name.toLowerCase()] ?? entity)
    .trim();
}

function tag(xml: string, name: string) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decodeXml(match?.[1] ?? "");
}

function categoryFor(name: string, description: string) : PlaceRecord["category"] {
  const text = `${name} ${description}`;
  if (/神社|観音堂|地蔵|寺|本宮/.test(text)) return "神社";
  if (/美術館|陶磁器|ギャラリー|芸術|蘭島閣/.test(text)) return "美術館";
  if (/食堂|cafe|カフェ|グルメ|海駅|であいの館/.test(text)) return "グルメ";
  if (/公園|海水浴場|キャンプ|昆虫の家/.test(text)) return "公園";
  if (/住宅|御本陣|松濤園|伝説|伝統|歴史|石碑|雁木|NEWS/.test(text)) return "歴史";
  return "絶景";
}

function cleanDescription(html: string) {
  return decodeXml(html)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stableId(name: string, lat: number, lng: number) {
  const input = `${name}|${lat.toFixed(6)}|${lng.toFixed(6)}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `mymaps-${(hash >>> 0).toString(36)}`;
}

function parsePlacemark(block: string, layer: string): PlaceRecord | null {
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
    category: categoryFor(name, description),
    lat,
    lng,
    description,
    image: photoUrl,
    photoUrl,
    youtube: youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : undefined,
    sourceLayer: layer,
  };
}

export function parseMyMapsKml(kml: string) {
  const places: PlaceRecord[] = [];
  const folderBlocks = [...kml.matchAll(/<Folder(?:\s[^>]*)?>([\s\S]*?)<\/Folder>/gi)];
  const covered = new Set<string>();
  for (const folderMatch of folderBlocks) {
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

function checksum(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash, 33) ^ input.charCodeAt(index);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function cachedBody(row: CacheRow, error?: string) {
  return {
    places: JSON.parse(row.payload) as PlaceRecord[],
    source: "Google My Maps cache",
    updatedAt: row.synced_at,
    spotCount: row.spot_count,
    sourceHash: row.source_hash,
    cached: true,
    syncError: error ?? row.last_error ?? undefined,
  };
}

export async function getPlacesData({ force }: { force: boolean }) {
  const db = database();
  const previous = await readCache(db);
  if (!force && previous && Date.now() - Date.parse(previous.synced_at) < CACHE_MAX_AGE_MS) {
    return { ok: true, body: cachedBody(previous) };
  }

  try {
    const response = await fetch(KML_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`マイマップ取得エラー (${response.status})`);
    const kml = await response.text();
    const places = parseMyMapsKml(kml);
    if (!places.length) throw new Error("マイマップに有効なスポットがありません");
    const syncedAt = new Date().toISOString();
    const sourceHash = checksum(kml);
    if (db) await writeCache(db, places, syncedAt, sourceHash);
    return {
      ok: true,
      body: { places, source: "Google My Maps", updatedAt: syncedAt, spotCount: places.length, sourceHash, cached: false },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "マイマップの同期に失敗しました";
    await rememberError(db, message);
    if (previous) return { ok: true, body: cachedBody(previous, message) };
    return { ok: false, body: { places: [], source: "unavailable", cached: false, syncError: message } };
  }
}
