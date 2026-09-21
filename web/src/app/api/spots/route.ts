import { NextResponse } from "next/server";
import { getSpots } from "@/lib/data";

export const dynamic = "force-dynamic";

/** 일정에 스팟 추가용 — 한산 권역 우선 목록 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(30, Math.max(5, Number(searchParams.get("limit") || 16)));
  let spots = getSpots();
  if (q) {
    spots = spots.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.region.toLowerCase().includes(q) ||
        s.theme.toLowerCase().includes(q)
    );
  }
  return NextResponse.json({
    spots: spots.slice(0, limit).map((s) => ({
      name: s.name,
      region: s.region,
      description: s.description,
      lat: s.lat,
      lng: s.lng,
      theme: s.theme,
      tip: s.tip,
      hours: s.hours,
      fee: s.fee,
      parking: s.parking,
      best_time: s.best_time,
    })),
  });
}
