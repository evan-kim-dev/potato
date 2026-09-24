import { NextRequest, NextResponse } from "next/server";
import { suggestStopsAlongDrive } from "@/lib/routeStops";
import type { TravelMode } from "@/lib/tripTypes";

export const dynamic = "force-dynamic";

function point(v: unknown) {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  const name = typeof p.name === "string" ? p.name.trim() : "";
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { name, lat, lng };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const origin = point(body?.origin);
    const destination = point(body?.destination);
    if (!origin || !destination) {
      return NextResponse.json(
        { error: "출발지와 도착지 좌표가 필요합니다." },
        { status: 400 }
      );
    }
    const mode = String(body?.mode || "car") as TravelMode;
    const safeMode: TravelMode =
      mode === "walk" || mode === "bicycle" || mode === "traffic" ? mode : "car";
    const prefer = Array.isArray(body?.preferRegions)
      ? body.preferRegions.filter((r: unknown) => typeof r === "string")
      : [];
    const suggested = await suggestStopsAlongDrive({
      origin,
      destination,
      mode: safeMode,
      durationHint: String(body?.duration || body?.durationHint || ""),
      preferRegions: prefer,
      text: String(body?.text || ""),
    });
    return NextResponse.json({
      ok: true,
      kind: suggested.kind,
      routeKm: Math.round(suggested.routeKm),
      deviationCapKm: Math.round(suggested.deviationCapKm * 10) / 10,
      title: suggested.title,
      summary: suggested.summary,
      steps: suggested.steps,
      dispersion: suggested.dispersion,
      stops: suggested.picks.map((p) => ({
        name: p.spot.name,
        region: p.spot.region,
        distanceKm: Math.round(p.distanceKm * 10) / 10,
        t: Math.round(p.t * 100) / 100,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "경유 추천 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
