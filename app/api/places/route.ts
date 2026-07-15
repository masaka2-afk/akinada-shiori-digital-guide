import { NextResponse } from "next/server";
import { getPlacesData } from "../../../lib/my-maps-sync";

export const runtime = "edge";

export async function GET() {
  const result = await getPlacesData({ force: false });
  return NextResponse.json(result.body, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST() {
  const result = await getPlacesData({ force: true });
  return NextResponse.json(result.body, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
