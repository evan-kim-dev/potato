import { NextResponse } from "next/server";
import { getCities } from "@/lib/data";
import { fetchGangwonWeather } from "@/lib/weather";

export const runtime = "nodejs";
export const revalidate = 600;

export async function GET() {
  try {
    const cities = await fetchGangwonWeather(getCities());
    return NextResponse.json(
      { cities, source: "open-meteo" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "날씨 조회 실패";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
