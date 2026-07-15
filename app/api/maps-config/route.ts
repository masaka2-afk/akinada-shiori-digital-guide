import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const mapId = process.env.GOOGLE_MAPS_MAP_ID?.trim() ?? "";
  return NextResponse.json(
    { configured: Boolean(apiKey), apiKey: apiKey || undefined, mapId: mapId || undefined },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
