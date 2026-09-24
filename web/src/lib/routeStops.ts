import { getSpots, getTourCatalogSpots, type Spot } from "@/lib/data";
import { scoreTripDispersion } from "@/lib/impactScore";
import { normalizeRegionName, regionsMentionedInText } from "@/lib/prefs";
import {
  fetchOsrmRoute,
  parseKakaoDirections,
  type OsrmProfile,
  type RoutePoint,
} from "@/lib/route";
import {
  fitRouteStops,
  type CorridorPick,
  type TravelKind,
} from "@/lib/routeCorridor";
import type { PlanStep, TravelMode } from "@/lib/tripTypes";

function kakaoKey() {
  return (process.env.KAKAO_REST_KEY || process.env.KAKAO_NAVI_KEY || "").trim();
}

function profileFor(mode: TravelMode): OsrmProfile {
  if (mode === "walk") return "foot";
  if (mode === "bicycle") return "bike";
  return "driving";
}

async function directPolyline(
  origin: RoutePoint,
  destination: RoutePoint,
  mode: TravelMode
): Promise<Array<{ lat: number; lng: number }>> {
  const key = kakaoKey();
  if (key && (mode === "car" || mode === "traffic")) {
    try {
      const params = new URLSearchParams({
        origin: `${origin.lng},${origin.lat}`,
        destination: `${destination.lng},${destination.lat}`,
        priority: "DISTANCE",
      });
      const res = await fetch(
        `https://apis-navi.kakaomobility.com/v1/directions?${params}`,
        { headers: { Authorization: `KakaoAK ${key}` }, next: { revalidate: 300 } }
      );
      if (res.ok) {
        const data = await res.json();
        const plan = parseKakaoDirections([origin, destination], data);
        if (plan && plan.polyline.length > 1) return plan.polyline;
      }
    } catch {
      /* osrm */
    }
  }
  const osrm = await fetchOsrmRoute([origin, destination], profileFor(mode));
  return osrm?.polyline || [];
}

type LiveDoc = {
  place_name?: string;
  category_name?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
};

const liveCache = new Map<string, { at: number; spots: Spot[] }>();

function regionFromAddress(addr: string) {
  for (const part of addr.split(/\s+/)) {
    const hit = normalizeRegionName(part);
    if (hit) return hit;
  }
  const city = addr.match(/(\S+(?:시|군))/)?.[1];
  return city || "";
}

function samplePolyline(
  polyline: Array<{ lat: number; lng: number }>,
  count: number
) {
  if (polyline.length <= count) return polyline;
  const cum = [0];
  for (let i = 1; i < polyline.length; i++) {
    const a = polyline[i - 1];
    const b = polyline[i];
    const dLat = (b.lat - a.lat) * 110.57;
    const dLng = (b.lng - a.lng) * 88.8;
    cum[i] = cum[i - 1] + Math.hypot(dLat, dLng);
  }
  const total = cum[cum.length - 1] || 1;
  const out: Array<{ lat: number; lng: number }> = [];
  for (let i = 1; i <= count; i++) {
    const target = (total * i) / (count + 1);
    let idx = cum.findIndex((c) => c >= target);
    if (idx < 0) idx = polyline.length - 1;
    out.push(polyline[idx]);
  }
  return out;
}

async function kakaoCategoryAt(
  lng: number,
  lat: number,
  code: "AT4" | "CT1",
  radius: number
): Promise<Spot[]> {
  const key = kakaoKey();
  if (!key) return [];
  const params = new URLSearchParams({
    category_group_code: code,
    x: String(lng),
    y: String(lat),
    radius: String(radius),
    size: "8",
    sort: "distance",
  });
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/category.json?${params}`,
    { headers: { Authorization: `KakaoAK ${key}` }, next: { revalidate: 120 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const docs = (data.documents || []) as LiveDoc[];
  const spots: Spot[] = [];
  for (const d of docs) {
    const name = (d.place_name || "").trim();
    const latN = Number(d.y);
    const lngN = Number(d.x);
    if (!name || !Number.isFinite(latN) || !Number.isFinite(lngN)) continue;
    if (/주차장|정류장|화장실|휴게소|주유소|충전소/.test(name)) continue;
    if (/(골|못|교)$/.test(name) && name.length <= 6) continue;
    const addr = d.road_address_name || d.address_name || "";
    const theme = (d.category_name || "").split(">").pop()?.trim() || "관광";
    spots.push({
      name,
      region: regionFromAddress(addr) || "강원",
      description: addr || theme,
      lat: latN,
      lng: lngN,
      theme,
    });
  }
  return spots;
}

/** 도로를 따라 관광·문화 장소를 실시간 검색 */
async function liveSpotsAlongPolyline(
  polyline: Array<{ lat: number; lng: number }>,
  routeKm: number
): Promise<Spot[]> {
  const key = kakaoKey();
  if (!key || polyline.length < 2) return [];
  const cacheKey = `q3|${polyline[0].lat.toFixed(2)},${polyline[0].lng.toFixed(2)}|${polyline[polyline.length - 1].lat.toFixed(2)},${polyline[polyline.length - 1].lng.toFixed(2)}|${Math.round(routeKm)}`;
  const hit = liveCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 3 * 60 * 1000) return hit.spots;

  const samples = samplePolyline(polyline, routeKm < 80 ? 3 : routeKm < 180 ? 5 : 6);
  const radius = Math.round(Math.min(20000, Math.max(8000, (routeKm / (samples.length + 1)) * 700)));
  const batches = await Promise.all(
    samples.flatMap((p) => [
      kakaoCategoryAt(p.lng, p.lat, "AT4", radius),
      kakaoCategoryAt(p.lng, p.lat, "CT1", radius),
    ])
  );
  const seen = new Set<string>();
  const spots: Spot[] = [];
  for (const list of batches) {
    for (const s of list) {
      const id = `${s.name}|${s.lat.toFixed(3)}|${s.lng.toFixed(3)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      spots.push(s);
    }
  }
  liveCache.set(cacheKey, { at: Date.now(), spots });
  return spots;
}

function roughRouteKm(polyline: Array<{ lat: number; lng: number }>) {
  let km = 0;
  for (let i = 1; i < polyline.length; i++) {
    const a = polyline[i - 1];
    const b = polyline[i];
    km += Math.hypot((b.lat - a.lat) * 110.57, (b.lng - a.lng) * 88.8);
  }
  return km;
}

/** 장소명 → 좌표. 키워드 검색 후 주소 검색. */
export async function geocodePlace(query: string): Promise<RoutePoint | null> {
  const q = query.trim();
  const key = kakaoKey();
  if (q.length < 2 || !key) return null;
  for (const path of ["keyword", "address"] as const) {
    try {
      const params = new URLSearchParams({ query: q, size: "1" });
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/${path}.json?${params}`,
        { headers: { Authorization: `KakaoAK ${key}` }, next: { revalidate: 300 } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const doc = (data.documents || [])[0] as
        | { place_name?: string; address_name?: string; x?: string; y?: string }
        | undefined;
      const lat = Number(doc?.y);
      const lng = Number(doc?.x);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      return {
        name: doc?.place_name || doc?.address_name || q,
        lat,
        lng,
      };
    } catch {
      /* next */
    }
  }
  return null;
}

function dayFor(t: number, durationHint?: string) {
  if (/2\s*박/.test(durationHint || "")) {
    if (t < 0.34) return 1;
    if (t < 0.67) return 2;
    return 3;
  }
  if (/1\s*박|하룻밤/.test(durationHint || "")) return t < 0.55 ? 1 : 2;
  return 1;
}

function toStep(pick: CorridorPick, index: number, total: number, durationHint?: string): PlanStep {
  const off = Math.max(1, Math.round(pick.distanceKm));
  const extra = Math.max(off, Math.round(pick.insertionKm));
  return {
    order: index + 1,
    day: dayFor(pick.t, durationHint),
    stay: 70 + (index % 2) * 15,
    why: `경로 적합 · 도로에서 ${off}km · 우회 약 ${extra}km`,
    move_to_next: index < total - 1 ? "다음 경유로 이어집니다" : undefined,
    kind: "stop",
    spot: {
      name: pick.spot.name,
      region: pick.spot.region,
      description: pick.spot.description,
      lat: pick.spot.lat,
      lng: pick.spot.lng,
      theme: pick.spot.theme,
      tip: pick.spot.tip,
      hours: pick.spot.hours,
      fee: pick.spot.fee,
      parking: pick.spot.parking,
      best_time: pick.spot.best_time,
    },
  };
}

export async function suggestStopsAlongDrive(input: {
  origin?: RoutePoint | null;
  destination?: RoutePoint | null;
  mode?: TravelMode;
  durationHint?: string;
  preferRegions?: string[];
  text?: string;
}): Promise<{
  picks: CorridorPick[];
  steps: PlanStep[];
  title: string;
  summary: string;
  kind: "corridor" | "nearby" | "none";
  routeKm: number;
  deviationCapKm: number;
  dispersion: ReturnType<typeof scoreTripDispersion>;
}> {
  const mode = input.mode || "car";
  const origin = input.origin || null;
  const destination = input.destination || null;
  const prefer = [
    ...(input.preferRegions || []),
    ...regionsMentionedInText(input.text || ""),
  ];
  const line =
    origin && destination
      ? await directPolyline(origin, destination, mode)
      : [];
  const routeGuess = roughRouteKm(line);
  const [live, catalog] = await Promise.all([
    liveSpotsAlongPolyline(line, routeGuess),
    Promise.resolve(getTourCatalogSpots()),
  ]);
  const seen = new Set<string>();
  const pool: Spot[] = [];
  for (const s of [...live, ...catalog]) {
    const id = `${s.name}|${s.lat.toFixed(3)}|${s.lng.toFixed(3)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    pool.push(s);
  }
  const spots = pool.length >= 4 ? pool : [...pool, ...getSpots()];
  const fit = fitRouteStops({
    spots,
    polyline: line,
    origin,
    destination,
    mode: mode as TravelKind,
    durationHint: input.durationHint,
    preferRegions: prefer,
  });
  const steps = fit.picks.map((p, i) => toStep(p, i, fit.picks.length, input.durationHint));
  const from = origin?.name?.replace(/\s/g, "") || "";
  const to = destination?.name?.replace(/\s/g, "") || "";
  const names = steps.map((s) => s.spot.name);
  const title =
    from && to ? `${from} → ${to} 가는 길` : from ? `${from} 주변` : to ? `${to} 주변` : "경로 맞춤 코스";
  const summary = names.length
    ? fit.kind === "nearby"
      ? `실시간 주변 검색 · ${names.join(" · ")}`
      : `실시간 경로 검색 · ${Math.round(fit.routeKm)}km · ${names.join(" · ")}`
    : "이 경로 위에서 실시간으로 찾은 명소가 없어요";
  return {
    picks: fit.picks,
    steps,
    title,
    summary,
    kind: fit.kind,
    routeKm: fit.routeKm,
    deviationCapKm: fit.deviationCapKm,
    dispersion: scoreTripDispersion(steps),
  };
}

export function spotsFromCorridor(picks: CorridorPick[]): Spot[] {
  return picks.map((p) => p.spot);
}
