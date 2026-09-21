import { NextResponse } from "next/server";
import { resolveForecastPayload } from "@/lib/forecastMsg";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  try {
    const payload = await resolveForecastPayload();
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "통보문 조회 실패";
    return NextResponse.json({ error: message, stub: true }, { status: 502 });
  }
}
