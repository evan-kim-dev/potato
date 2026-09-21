import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getKakaoRestKey() {
  return (
    process.env.KAKAO_REST_KEY ||
    process.env.KAKAO_NAVI_KEY ||
    ""
  ).trim();
}

export type PlaceHit = {
  id: string;
  name: string;
  address: string;
  region: string;
  lat: number;
  lng: number;
};

async function kakaoLocal(
  path: "keyword" | "address",
  q: string,
  key: string
): Promise<PlaceHit[]> {
  const params = new URLSearchParams({ query: q, size: "8" });
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/${path}.json?${params}`,
    {
      headers: { Authorization: `KakaoAK ${key}` },
      next: { revalidate: 120 },
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  if (path === "keyword") {
    return (data.documents || []).map((d: Record<string, string>) => ({
      id: d.id || `${d.x},${d.y}`,
      name: d.place_name,
      address: d.road_address_name || d.address_name || "",
      region: d.address_name?.split(" ").slice(0, 2).join(" ") || "",
      lat: Number(d.y),
      lng: Number(d.x),
    }));
  }
  return (data.documents || []).map(
    (d: {
      address_name?: string;
      address?: { address_name?: string; x?: string; y?: string };
      road_address?: { address_name?: string; x?: string; y?: string };
      x?: string;
      y?: string;
    }) => {
      const road = d.road_address;
      const addr = d.address;
      const name =
        road?.address_name || addr?.address_name || d.address_name || q;
      const x = road?.x || addr?.x || d.x;
      const y = road?.y || addr?.y || d.y;
      return {
        id: `${x},${y}`,
        name,
        address: name,
        region: name.split(" ").slice(0, 2).join(" "),
        lat: Number(y),
        lng: Number(x),
      };
    }
  );
}

/** 카카오 키워드 + 주소 검색 — 서울·경기 등 임의 출발/도착 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 1) {
    return NextResponse.json({ places: [] });
  }
  if (q.length > 40) {
    return NextResponse.json({ error: "검색어가 너무 깁니다." }, { status: 400 });
  }

  const key = getKakaoRestKey();
  if (!key) {
    return NextResponse.json(
      { error: "장소 검색을 위해 KAKAO_REST_KEY가 필요합니다.", places: [] },
      { status: 503 }
    );
  }

  try {
    const [kw, addr] = await Promise.all([
      kakaoLocal("keyword", q, key),
      kakaoLocal("address", q, key),
    ]);
    const seen = new Set<string>();
    const places: PlaceHit[] = [];
    for (const p of [...kw, ...addr]) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      const k = `${p.name}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      places.push(p);
      if (places.length >= 10) break;
    }
    return NextResponse.json({ places });
  } catch (e) {
    const message = e instanceof Error ? e.message : "장소 검색 오류";
    return NextResponse.json({ error: message, places: [] }, { status: 500 });
  }
}
