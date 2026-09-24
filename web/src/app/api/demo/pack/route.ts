import { NextResponse } from "next/server";
import { getQuietGems, getSpots } from "@/lib/data";
import { getSeedMerchants } from "@/lib/merchants";
import { scoreTripDispersion } from "@/lib/impactScore";
import { QUIET_REGIONS } from "@/lib/prefs";
import { geocodePlace, suggestStopsAlongDrive } from "@/lib/routeStops";
import type { PlanStep } from "@/lib/tripTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFERRED = ["정선군", "영월군", "태백시", "인제군"] as const;

/**
 * 심사 데모용 팩 — TourAPI 동기화 카탈로그·시드 가맹에서 실제 스팟을 고름.
 * (강원페이 결제는 여전히 클라이언트 MOCK)
 */
export async function GET() {
  const quietSet = new Set<string>(QUIET_REGIONS);
  try {
    const [origin, destination] = await Promise.all([
      geocodePlace("서울역"),
      geocodePlace("강릉역"),
    ]);
    if (origin && destination) {
      const along = await suggestStopsAlongDrive({
        origin,
        destination,
        mode: "car",
        durationHint: "당일",
      });
      if (along.picks.length >= 2) {
        const steps: PlanStep[] = along.steps;
        const dispersion = scoreTripDispersion(steps);
        const regions = [...new Set(steps.map((s) => s.spot.region))];
        const merchants = getSeedMerchants().filter((m) =>
          regions.includes(m.region)
        );
        const merchant = merchants[0] || getSeedMerchants()[0] || null;
        return NextResponse.json({
          ok: true,
          source: "live-route",
          generatedAt: new Date().toISOString(),
          trip: {
            id: "demo-trip-seoul-gangneung",
            query: "서울역 → 강릉역",
            title: along.title || "서울역 → 강릉역 가는 길",
            summary: along.summary,
            duration: "당일",
            source: "demo-seed-live",
            stopNames: steps.map((s) => s.spot.name),
            mode: "car" as const,
            origin,
            destination,
            steps,
            dispersion,
            regions,
          },
          merchant: merchant
            ? { name: merchant.name, region: merchant.region, amount: 16000 }
            : { name: "한산 권역 가맹 샘플", region: regions[0] || "영월군", amount: 16000 },
          communityHints: steps.slice(0, 3).map((s) => ({
            region: s.spot.region,
            name: s.spot.name,
          })),
          catalog: { quietSpots: 0, picked: steps.length, live: true },
        });
      }
    }
  } catch {
    /* 카탈로그 폴백 */
  }
  const gems = getQuietGems(24);
  const all = getSpots().filter((s) => quietSet.has(s.region));

  const picked: typeof gems = [];
  const usedRegion = new Set<string>();

  for (const region of PREFERRED) {
    const hit =
      gems.find((s) => s.region === region) ||
      all.find((s) => s.region === region);
    if (hit && !picked.some((p) => p.name === hit.name)) {
      picked.push(hit);
      usedRegion.add(region);
    }
  }
  for (const s of gems) {
    if (picked.length >= 4) break;
    if (usedRegion.has(s.region) && picked.length >= 3) continue;
    if (picked.some((p) => p.name === s.name)) continue;
    picked.push(s);
    usedRegion.add(s.region);
  }
  while (picked.length < 3 && all.length) {
    const s = all[picked.length % all.length];
    if (!picked.some((p) => p.name === s.name)) picked.push(s);
    else break;
  }

  const stops = picked.slice(0, 4);
  const steps: PlanStep[] = stops.map((s, i) => ({
    order: i + 1,
    day: 1,
    stay: 70 + (i % 3) * 15,
    why:
      i === 0
        ? "한산 권역 TourAPI 카탈로그 스팟"
        : i === stops.length - 1
          ? "인접 권역 체류 마무리"
          : "인구감소 권역 분산 동선",
    spot: {
      name: s.name,
      region: s.region,
      description: s.description || `${s.region} 한산 명소`,
      lat: s.lat,
      lng: s.lng,
      theme: s.theme || "한산",
      tip: s.tip,
      hours: s.hours,
      fee: s.fee,
      parking: s.parking,
      best_time: s.best_time,
    },
  }));

  const dispersion = scoreTripDispersion(steps);
  const regions = [...new Set(steps.map((s) => s.spot.region))];
  const merchants = getSeedMerchants().filter((m) =>
    regions.includes(m.region)
  );
  const merchant =
    merchants[0] ||
    getSeedMerchants().find((m) => quietSet.has(m.region)) ||
    null;

  const communityHints = stops.slice(0, 3).map((s) => ({
    region: s.region,
    name: s.name,
  }));

  return NextResponse.json(
    {
      ok: true,
      source: "tourapi-catalog",
      generatedAt: new Date().toISOString(),
      trip: {
        id: "demo-trip-quiet-cluster",
        query: `${regions.map((r) => r.replace(/(시|군)$/, "")).join("·")} 한산 코스`,
        title: `${regions
          .slice(0, 2)
          .map((r) => r.replace(/(시|군)$/, ""))
          .join("·")} 한산 클러스터`,
        summary: `TourAPI 동기화 카탈로그 기반 저밀도 코스 · 분산 ${dispersion.score}·${dispersion.grade}`,
        duration: "당일",
        source: "demo-seed-catalog",
        stopNames: steps.map((s) => s.spot.name),
        mode: "car" as const,
        steps,
        dispersion,
        regions,
      },
      merchant: merchant
        ? {
            name: merchant.name,
            region: merchant.region,
            amount: 16000,
          }
        : {
            name: "한산 권역 가맹 샘플",
            region: regions[0] || "영월군",
            amount: 16000,
          },
      communityHints,
      catalog: {
        quietSpots: all.length,
        picked: stops.length,
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
