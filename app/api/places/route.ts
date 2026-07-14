import { NextResponse } from "next/server";

export const runtime = "edge";

const MAP_ID = "1TbtYyvz6fS9qpn43ZbrWi6NnRYDaVXs";

const entityMap: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function decode(value: string) {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&(amp|lt|gt|quot|#39);/g, (entity) => entityMap[entity] ?? entity)
    .trim();
}

function tag(xml: string, name: string) {
  return decode(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? "");
}

function categoryFor(name: string) {
  if (/神社|観音堂|地蔵|寺/.test(name)) return "神社";
  if (/美術館|陶磁器|ギャラリー|芸術/.test(name)) return "美術館";
  if (/食堂|cafe|カフェ|海駅|みなとオアシス/.test(name)) return "グルメ";
  if (/公園|海水浴場|キャンプ|昆虫の家/.test(name)) return "公園";
  if (/住宅|本陣|松濤園|雁木|伝説|石碑|伝統|町並み|歴史/.test(name)) return "歴史";
  return "絶景";
}

function cleanDescription(html: string) {
  return decode(html)
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  try {
    const response = await fetch(`https://www.google.com/maps/d/kml?mid=${MAP_ID}&forcekml=1`, {
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error("Map data unavailable");
    const kml = await response.text();
    const blocks = [...kml.matchAll(/<Placemark(?:\s[^>]*)?>([\s\S]*?)<\/Placemark>/gi)];
    const places = blocks.flatMap((match, index) => {
      const block = match[1];
      const coords = tag(block, "coordinates").split(",");
      if (coords.length < 2 || !Number.isFinite(Number(coords[0])) || !Number.isFinite(Number(coords[1]))) return [];
      const name = tag(block, "name") || `スポット ${index + 1}`;
      const descriptionHtml = tag(block, "description");
      const image = descriptionHtml.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
      const youtube = descriptionHtml.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/i)?.[1];
      return [{
        id: `${index}-${name}`,
        name,
        category: categoryFor(name),
        lat: Number(coords[1]),
        lng: Number(coords[0]),
        description: cleanDescription(descriptionHtml),
        image,
        youtube: youtube ? `https://www.youtube.com/watch?v=${youtube}` : undefined,
      }];
    });
    return NextResponse.json({ places, source: "Google My Maps", updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ places: [], source: "fallback" }, { status: 503 });
  }
}
