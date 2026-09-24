import { NextResponse } from "next/server";
import { getSpots } from "@/lib/data";

export const dynamic = "force-dynamic";

function restKey() {
  return (process.env.KAKAO_REST_KEY || process.env.KAKAO_NAVI_KEY || "").trim();
}

function regionFromAddress(address: string) {
  const token = address.match(/([가-힣]+(?:시|군))/)?.[1];
  return token || "검색";
}

/** 카탈로그에 없으면 카카오 장소 검색으로 보강 */
async function liveSpots(q: string) {
  const key = restKey();
  if (!key || q.length < 2) return [];
  try {
    const params = new URLSearchParams({ query: q, size: "5" });
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
      { headers: { Authorization: `KakaoAK ${key}` }, next: { revalidate: 120 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.documents || [])
      .map((d: Record<string, string>) => {
        const lat = Number(d.y);
        const lng = Number(d.x);
        const address = d.road_address_name || d.address_name || "";
        if (!d.place_name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (/주차장|충전소|휴게소|화장실|편의점/.test(d.place_name)) return null;
        return {
          name: d.place_name,
          region: regionFromAddress(address),
          description: address,
          lat,
          lng,
          theme: "검색",
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** 일정에 스팟 추가용 — TourAPI 카탈로그, 부족하면 실시간 장소 검색 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const qLower = q.toLowerCase();
  const limit = Math.min(30, Math.max(5, Number(searchParams.get("limit") || 16)));
  let spots = getSpots();
  if (qLower) {
    spots = spots.filter(
      (s) =>
        s.name.toLowerCase().includes(qLower) ||
        s.region.toLowerCase().includes(qLower) ||
        (s.theme || "").toLowerCase().includes(qLower) ||
        (s.description || "").toLowerCase().includes(qLower)
    );
  }
  const mapped = spots.slice(0, limit).map((s) => ({
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
  }));
  if (q && mapped.length < 3) {
    const extra = await liveSpots(q);
    const seen = new Set(mapped.map((s) => s.name));
    for (const row of extra) {
      if (!row || seen.has(row.name)) continue;
      mapped.push(row);
      seen.add(row.name);
      if (mapped.length >= limit) break;
    }
  }
  return NextResponse.json({ spots: mapped, live: Boolean(q && mapped.length) });
}
