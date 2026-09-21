import { NextResponse } from "next/server";
import { getBeachRows } from "@/lib/data";
import { fetchBeachLiveWeather } from "@/lib/beachWeather";

export const runtime = "nodejs";
export const revalidate = 600;

export async function GET() {
  try {
    const beaches = await fetchBeachLiveWeather(getBeachRows());
    return NextResponse.json(
      { beaches, source: "open-meteo" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "해변 날씨 조회 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
