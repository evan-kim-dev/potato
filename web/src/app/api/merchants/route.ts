import { NextRequest, NextResponse } from "next/server";
import { merchantsNear, type LocalMerchant } from "@/lib/merchants";

export const dynamic = "force-dynamic";

function getKakaoRestKey() {
  return (
    process.env.KAKAO_REST_KEY ||
    process.env.KAKAO_NAVI_KEY ||
    ""
  ).trim();
}

async function kakaoNearbyFood(
  lat: number,
  lng: number,
  region: string,
  key: string
): Promise<LocalMerchant[]> {
  const short = region.replace(/(시|군)$/, "");
  const q = `${short} 맛집`;
  const params = new URLSearchParams({
    query: q,
    x: String(lng),
    y: String(lat),
    radius: "8000",
    size: "5",
    sort: "distance",
  });
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
    {
      headers: { Authorization: `KakaoAK ${key}` },
      next: { revalidate: 300 },
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.documents || []).slice(0, 3).map(
    (d: Record<string, string>, i: number): LocalMerchant => ({
      id: `kakao-${d.id || i}`,
      name: d.place_name,
      region,
      category: d.category_name?.split(">").pop()?.trim() || "음식점",
      lat: Number(d.y),
      lng: Number(d.x),
      address: d.road_address_name || d.address_name || "",
      pay: ["강원페이 확인"],
      note: "카카오 로컬 · 강원페이 가맹은 앱에서 재확인",
      source: "kakao",
      distanceKm: d.distance ? Math.round(Number(d.distance) / 100) / 10 : undefined,
    })
  );
}

/** 일정 스탑 근처 지역화폐·로컬 가맹점 */
export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const region = (req.nextUrl.searchParams.get("region") || "").trim();
  const limit = Math.min(5, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 3)));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng 필요", merchants: [] }, { status: 400 });
  }

  const seed = merchantsNear(lat, lng, { region: region || undefined, limit });
  let live: LocalMerchant[] = [];
  const key = getKakaoRestKey();
  if (key && region) {
    try {
      live = await kakaoNearbyFood(lat, lng, region, key);
    } catch {
      live = [];
    }
  }

  const seen = new Set<string>();
  const merchants: LocalMerchant[] = [];
  for (const m of [...seed, ...live]) {
    const k = `${m.name}|${m.lat.toFixed(3)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    merchants.push(m);
    if (merchants.length >= limit) break;
  }

  return NextResponse.json({
    merchants,
    meta: {
      seed: seed.length,
      kakao: live.length,
      needsKakaoKey: !key,
      komscoHint:
        "결제 KPI: 조폐공사 결제정보(KOMSCO_PAYMENT_KEY) · 가맹 핀: 통합 가맹점기본정보(별도)",
    },
  });
}
