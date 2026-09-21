import { NextRequest, NextResponse } from "next/server";
import {
  fetchOsrmRoute,
  parseKakaoDirections,
  straightRoute,
  type OsrmProfile,
  type RoutePoint,
} from "@/lib/route";

export const dynamic = "force-dynamic";

const TTL_MS = 5 * 60 * 1000;
const routeCache = new Map<string, { at: number; body: unknown }>();

type TravelMode = "car" | "walk" | "bicycle" | "traffic";

function asPoint(v: unknown): RoutePoint | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  const name = typeof p.name === "string" ? p.name : "";
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    name,
    lat,
    lng,
    region: typeof p.region === "string" ? p.region : undefined,
  };
}

function cacheKey(points: RoutePoint[], mode: TravelMode) {
  return (
    mode +
    "|" +
    points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|")
  );
}

function getCached(key: string) {
  const hit = routeCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    routeCache.delete(key);
    return null;
  }
  return hit.body;
}

function setCached(key: string, body: unknown) {
  if (routeCache.size > 80) {
    const first = routeCache.keys().next().value;
    if (first) routeCache.delete(first);
  }
  routeCache.set(key, { at: Date.now(), body });
}

function getKakaoRestKey() {
  return (
    process.env.KAKAO_REST_KEY ||
    process.env.KAKAO_NAVI_KEY ||
    ""
  ).trim();
}

function jsonCached(body: unknown) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=240",
    },
  });
}

function osrmProfile(mode: TravelMode): OsrmProfile {
  if (mode === "walk") return "foot";
  if (mode === "bicycle") return "bike";
  return "driving";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = (body?.mode || "car") as TravelMode;
    const stops = ((body?.points || body?.waypoints || []) as unknown[])
      .map(asPoint)
      .filter((p): p is RoutePoint => Boolean(p));
    const customOrigin = asPoint(body?.origin);
    const customDest = asPoint(body?.destination);

    // 출발·도착은 서울/경기 등 임의 지점, 일정 스팟은 경유
    let origin = customOrigin || (stops.length ? stops[0] : null);
    let destination =
      customDest || (stops.length > 1 ? stops[stops.length - 1] : null);

    // 경유 1곳 + 출발만/도착만 지정
    if (!destination && origin && stops.length === 1 && customOrigin) {
      destination = stops[0];
    }
    if (!origin && destination && stops.length === 1 && customDest) {
      origin = stops[0];
    }

    if (!origin || !destination) {
      return NextResponse.json(
        { error: "출발지와 도착지를 지정해 주세요. (경유 명소 2곳 이상 또는 출발·도착)" },
        { status: 400 }
      );
    }

    // 경유: 일정 스팟 (출발/도착과 좌표가 겹치면 제외)
    const same = (a: RoutePoint, b: RoutePoint) =>
      Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4;
    let middle = stops.filter((s) => !same(s, origin) && !same(s, destination));
    // 커스텀 출발/도착이면 일정 전체를 경유로
    if (customOrigin || customDest) {
      middle = stops.filter((s) => !same(s, origin) && !same(s, destination));
    } else if (stops.length >= 2) {
      middle = stops.slice(1, -1);
    }

    const ordered = [origin, ...middle, destination].slice(0, 8);
    if (ordered.length < 2) {
      return NextResponse.json({ error: "경로 지점이 부족합니다." }, { status: 400 });
    }

    const key = cacheKey(ordered, mode);
    const cached = getCached(key);
    if (cached) return jsonCached(cached);

    const kakaoKey = getKakaoRestKey();
    if (kakaoKey && (mode === "car" || mode === "traffic")) {
      try {
        const o = ordered[0];
        const d = ordered[ordered.length - 1];
        const mid = ordered.slice(1, -1);
        const params = new URLSearchParams({
          origin: `${o.lng},${o.lat}`,
          destination: `${d.lng},${d.lat}`,
          priority: mode === "traffic" ? "TIME" : "RECOMMEND",
        });
        if (mid.length) {
          params.set("waypoints", mid.map((p) => `${p.lng},${p.lat}`).join("|"));
        }
        const res = await fetch(
          `https://apis-navi.kakaomobility.com/v1/directions?${params}`,
          {
            headers: { Authorization: `KakaoAK ${kakaoKey}` },
            next: { revalidate: 300 },
          }
        );
        if (res.ok) {
          const data = await res.json();
          const plan = parseKakaoDirections(ordered, data);
          if (plan) {
            const out = { ...plan, mode, origin: o, destination: d };
            setCached(key, out);
            return jsonCached(out);
          }
        }
      } catch {
        /* fall through */
      }
    }

    const osrm = await fetchOsrmRoute(ordered, osrmProfile(mode));
    if (osrm) {
      const out = {
        ...osrm,
        mode,
        origin: ordered[0],
        destination: ordered[ordered.length - 1],
      };
      setCached(key, out);
      return jsonCached(out);
    }

    const straight = straightRoute(ordered);
    const out = {
      ...straight,
      mode,
      origin: ordered[0],
      destination: ordered[ordered.length - 1],
    };
    setCached(key, out);
    return jsonCached(out);
  } catch (e) {
    const message = e instanceof Error ? e.message : "경로 조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
