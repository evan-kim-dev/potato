import { getSpots, getTourCatalogSpots, type Spot } from "@/lib/data";
import { scoreTripDispersion } from "@/lib/impactScore";
import {
  normalizeRegionName,
  QUIET_REGIONS,
  REGION_NEIGHBORS,
  regionsInMentionOrder,
  regionsMentionedInText,
} from "@/lib/prefs";
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

function roughKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = (b.lat - a.lat) * 110.57;
  const dLng = (b.lng - a.lng) * 88.8;
  return Math.hypot(dLat, dLng);
}

let centerCache: RoutePoint[] | null = null;

/** 시·군 카탈로그 좌표의 중심. 도로가 그 권역을 지나면 그 동네도 실시간 검색 */
function regionCenters(): RoutePoint[] {
  if (centerCache) return centerCache;
  const groups = new Map<string, { lat: number; lng: number; n: number }>();
  for (const spot of getTourCatalogSpots()) {
    const row = groups.get(spot.region) || { lat: 0, lng: 0, n: 0 };
    row.lat += spot.lat;
    row.lng += spot.lng;
    row.n += 1;
    groups.set(spot.region, row);
  }
  centerCache = [...groups.entries()].map(([region, row]) => ({
    name: region,
    region,
    lat: row.lat / row.n,
    lng: row.lng / row.n,
  }));
  return centerCache;
}

async function pointForRegion(region: string): Promise<RoutePoint | null> {
  const short = region.replace(/(시|군)$/, "");
  const query = region.endsWith("군") ? `${short}군청` : `${short}시청`;
  const geo = await geocodePlace(query);
  if (geo) return { ...geo, name: region, region };
  return regionCenters().find((c) => c.region === region) || null;
}

/** 좌표가 없으면 문장에 나온 강원 시·군을 출발·도착으로 씀 */
async function fillEndsFromRegions(
  origin: RoutePoint | null,
  destination: RoutePoint | null,
  text: string
): Promise<{ origin: RoutePoint | null; destination: RoutePoint | null }> {
  if (origin && destination) return { origin, destination };
  const named = regionsInMentionOrder(text);
  if (!origin && !destination) {
    if (named.length >= 2) {
      const [a, b] = await Promise.all([
        pointForRegion(named[0]),
        pointForRegion(named[named.length - 1]),
      ]);
      return { origin: a, destination: b };
    }
    if (named.length === 1) {
      return { origin: null, destination: await pointForRegion(named[0]) };
    }
    return { origin, destination };
  }
  if (!destination && origin) {
    const rest = named.filter((r) => r !== origin.region && !origin.name.includes(r.replace(/(시|군)$/, "")));
    if (rest.length) return { origin, destination: await pointForRegion(rest[rest.length - 1]) };
  }
  if (!origin && destination) {
    const rest = named.filter(
      (r) => r !== destination.region && !destination.name.includes(r.replace(/(시|군)$/, ""))
    );
    if (rest.length) return { origin: await pointForRegion(rest[0]), destination };
  }
  return { origin, destination };
}

/** 도로를 따라 관광·문화 장소를 실시간 검색 */
async function liveSpotsAlongPolyline(
  polyline: Array<{ lat: number; lng: number }>,
  routeKm: number
): Promise<Spot[]> {
  const key = kakaoKey();
  if (!key || polyline.length < 2) return [];
  const cacheKey = `q4|${polyline[0].lat.toFixed(2)},${polyline[0].lng.toFixed(2)}|${polyline[polyline.length - 1].lat.toFixed(2)},${polyline[polyline.length - 1].lng.toFixed(2)}|${Math.round(routeKm)}`;
  const hit = liveCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 3 * 60 * 1000) return hit.spots;

  const samples = samplePolyline(polyline, routeKm < 80 ? 3 : routeKm < 180 ? 5 : 6);
  const radius = Math.round(Math.min(20000, Math.max(8000, (routeKm / (samples.length + 1)) * 700)));
  const cap = Math.min(22, Math.max(8, routeKm * 0.065));
  const anchors = regionCenters().filter((c) =>
    samples.some((p) => roughKm(p, c) <= cap + 4)
  );
  const batches = await Promise.all([
    ...samples.flatMap((p) => [
      kakaoCategoryAt(p.lng, p.lat, "AT4", radius),
      kakaoCategoryAt(p.lng, p.lat, "CT1", radius),
    ]),
    ...anchors.flatMap((c) => [
      kakaoCategoryAt(c.lng, c.lat, "AT4", 12000),
      kakaoCategoryAt(c.lng, c.lat, "CT1", 12000),
    ]),
  ]);
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

const GANGWON = new Set(Object.keys(REGION_NEIGHBORS));
const QUIET = new Set<string>(QUIET_REGIONS);
const COAST = new Set(["강릉시", "속초시", "양양군", "동해시", "삼척시", "고성군"]);
const NATURE = new Set([
  "춘천시",
  "홍천군",
  "인제군",
  "평창군",
  "정선군",
  "영월군",
  "화천군",
  "양구군",
  "철원군",
  "횡성군",
  "태백시",
]);

type DriveResult = {
  picks: CorridorPick[];
  steps: PlanStep[];
  title: string;
  summary: string;
  kind: "corridor" | "nearby" | "none";
  routeKm: number;
  deviationCapKm: number;
  dispersion: ReturnType<typeof scoreTripDispersion>;
  origin: RoutePoint | null;
  destination: RoutePoint | null;
};

function nightsOf(durationHint?: string, text?: string) {
  const t = `${durationHint || ""} ${text || ""}`;
  if (/2\s*박|3\s*박|4\s*박/.test(t)) return 2;
  if (/1\s*박|하룻밤/.test(t)) return 1;
  return 0;
}

function themeTags(text?: string) {
  const t = text || "";
  const tags = new Set<string>();
  if (/바다|해변|해수욕|서핑/.test(t)) tags.add("sea");
  if (/자연|숲|계곡|산\b|힐링|휴양/.test(t)) tags.add("nature");
  if (/드라이브|드라이브|자동차|야경/.test(t)) tags.add("drive");
  if (/문화|박물관|미술관|역사/.test(t)) tags.add("culture");
  if (/한산|조용|인구감소/.test(t)) tags.add("quiet");
  if (/카페/.test(t)) tags.add("cafe");
  return tags;
}

function oneWayBudgetKm(nights: number) {
  if (nights >= 2) return 300;
  if (nights === 1) return 240;
  return 185;
}

/** 출발·도착이 같은 생활권이고 강원 밖이면, 다녀오는 강원 여행으로 본다 */
function isOutsideRoundTrip(origin: RoutePoint, destination: RoutePoint) {
  if (roughKm(origin, destination) > 45) return false;
  const centers = regionCenters();
  if (!centers.length) return false;
  const nearest = Math.min(
    ...centers.map((c) => Math.min(roughKm(origin, c), roughKm(destination, c)))
  );
  return nearest > 35 && nearest < 340;
}

function scoreAnchor(
  center: RoutePoint,
  origin: RoutePoint,
  nights: number,
  themes: Set<string>,
  named: string[]
) {
  const d = roughKm(origin, center);
  const namedHit = named.includes(center.region || "");
  const budget = oneWayBudgetKm(nights) + (namedHit ? 40 : 0);
  if (d > budget || d < 40) return -1;
  const ideal = nights >= 2 ? 230 : nights === 1 ? 175 : 115;
  let score = -Math.abs(d - ideal) / 45;
  if (named.includes(center.region || "")) score += 6;
  if (themes.has("sea") && COAST.has(center.region || "")) score += 4;
  if ((themes.has("nature") || themes.has("drive")) && NATURE.has(center.region || "")) score += 3;
  if (themes.has("quiet") && QUIET.has(center.region || "")) score += 2.5;
  if (themes.has("culture")) score += COAST.has(center.region || "") ? 0.4 : 1.1;
  if (!themes.size && NATURE.has(center.region || "")) score += 0.8;
  return score;
}

function gangwonOnly(steps: PlanStep[]) {
  return steps.filter((s) => GANGWON.has(s.spot.region));
}

function ensureAnchorStop(steps: PlanStep[], anchor: RoutePoint): PlanStep[] {
  if (!anchor.region || steps.some((s) => s.spot.region === anchor.region)) return steps;
  const spots = getTourCatalogSpots()
    .filter((s) => s.region === anchor.region && roughKm(s, anchor) < 35)
    .sort((a, b) => {
      const score = (s: Spot) =>
        (/해변|해수욕|박물관|국립|휴양|폭포|전망|수목|호수/.test(`${s.name} ${s.theme}`) ? 2 : 0) -
        roughKm(s, anchor) / 30;
      return score(b) - score(a);
    });
  const spot = spots[0];
  if (!spot) return steps;
  const short = anchor.region.replace(/(시|군)$/, "");
  return [
    ...steps,
    {
      order: steps.length + 1,
      day: 1,
      stay: 80,
      why: `${short}까지 다녀오는 지점`,
      kind: "stop",
      spot: {
        name: spot.name,
        region: spot.region,
        description: spot.description,
        lat: spot.lat,
        lng: spot.lng,
        theme: spot.theme || "관광",
      },
    },
  ];
}

function assignDays(steps: PlanStep[], nights: number): PlanStep[] {
  const days = nights + 1;
  return steps.map((step, i) => ({
    ...step,
    order: i + 1,
    day: Math.min(days, 1 + Math.floor((i * days) / Math.max(steps.length, 1))),
  }));
}

async function planGangwonRoundTrip(
  origin: RoutePoint,
  destination: RoutePoint,
  input: {
    mode: TravelMode;
    durationHint?: string;
    preferRegions?: string[];
    text?: string;
  }
): Promise<DriveResult | null> {
  const text = `${input.text || ""} ${input.durationHint || ""} ${(input.preferRegions || []).join(" ")}`;
  const nights = nightsOf(input.durationHint, text);
  const themes = themeTags(text);
  const named = regionsInMentionOrder(text);
  const ranked = regionCenters()
    .map((center) => ({ center, score: scoreAnchor(center, origin, nights, themes, named) }))
    .filter((row) => row.score > -0.5)
    .sort((a, b) => b.score - a.score);
  const anchor = ranked[0]?.center;
  if (!anchor?.region) return null;

  let outbound: DriveResult | null = null;
  let steps: PlanStep[] = [];
  for (const row of ranked.slice(0, 4)) {
    const candidate = row.center;
    if (!candidate.region) continue;
    const leg = await driveBetween({
      origin,
      destination: candidate,
      mode: input.mode,
      durationHint: input.durationHint,
      preferRegions: [candidate.region, ...named],
      text,
    });
    let next = gangwonOnly(leg.steps);
    if (nights >= 1) {
      const back = ranked.find(
        (item) => item.center.region && item.center.region !== candidate.region && roughKm(item.center, candidate) > 25
      )?.center;
      if (back?.region) {
        const inbound = await driveBetween({
          origin: candidate,
          destination: back,
          mode: input.mode,
          durationHint: input.durationHint,
          preferRegions: [back.region, ...named],
          text,
        });
        const seen = new Set(next.map((s) => s.spot.name));
        for (const step of gangwonOnly(inbound.steps)) {
          if (seen.has(step.spot.name)) continue;
          if (next.some((s) => roughKm(s.spot, step.spot) < 3)) continue;
          next.push(step);
          seen.add(step.spot.name);
        }
      }
    }
    next = ensureAnchorStop(next, candidate);
    const cap = nights >= 2 ? 6 : nights === 1 ? 5 : 3;
    const atAnchor = next.filter((s) => s.spot.region === candidate.region).slice(0, 1);
    const along = next.filter((s) => s.spot.region !== candidate.region).slice(0, Math.max(0, cap - atAnchor.length));
    next = [...along, ...atAnchor];
    if (next.length >= 2) {
      outbound = leg;
      steps = next;
      break;
    }
  }
  if (!outbound || steps.length < 2) return null;
  const anchorRegion = steps[steps.length - 1]?.spot.region || anchor.region;
  steps = assignDays(steps, nights);

  const names = steps.map((s) => s.spot.name);
  const themeLabel = themes.has("sea")
    ? "바다"
    : themes.has("culture")
      ? "문화"
      : themes.has("quiet")
        ? "한산"
        : themes.has("drive")
          ? "드라이브"
          : "자연";
  const dayLabel = nights >= 2 ? "2박" : nights === 1 ? "1박" : "당일";
  const short = anchorRegion.replace(/(시|군)$/, "");
  const picks: CorridorPick[] = steps.map((step) => ({
    spot: step.spot,
    distanceKm: 0,
    t: 0,
    insertionKm: 0,
    utility: 1,
  }));
  return {
    picks,
    steps,
    title: `${origin.name}에서 다녀오는 ${short} ${themeLabel}`,
    summary: `${dayLabel} · ${themeLabel} · ${short}까지 강원 코스 · ${names.join(" · ")}`,
    kind: "corridor",
    routeKm: outbound.routeKm,
    deviationCapKm: outbound.deviationCapKm,
    dispersion: scoreTripDispersion(steps),
    origin,
    destination,
  };
}

/** 두 점 사이 도로에 얹는 경유. 왕복 판정은 하지 않는다 */
async function driveBetween(input: {
  origin?: RoutePoint | null;
  destination?: RoutePoint | null;
  mode?: TravelMode;
  durationHint?: string;
  preferRegions?: string[];
  text?: string;
}): Promise<DriveResult> {
  const mode = input.mode || "car";
  const filled = await fillEndsFromRegions(
    input.origin || null,
    input.destination || null,
    `${input.text || ""}\n${(input.preferRegions || []).join(" ")}`
  );
  const origin = filled.origin;
  const destination = filled.destination;
  const prefer = [
    ...(input.preferRegions || []),
    ...regionsMentionedInText(input.text || ""),
  ];
  const line =
    origin && destination
      ? await directPolyline(origin, destination, mode)
      : [];
  const routeGuess = roughRouteKm(line);
  const center = destination || origin;
  const liveNear =
    center && line.length < 2
      ? Promise.all([
          kakaoCategoryAt(center.lng, center.lat, "AT4", 15000),
          kakaoCategoryAt(center.lng, center.lat, "CT1", 15000),
        ]).then(([a, b]) => [...a, ...b])
      : Promise.resolve([] as Spot[]);
  const [liveAlong, liveCity, catalog] = await Promise.all([
    liveSpotsAlongPolyline(line, routeGuess),
    liveNear,
    Promise.resolve(getTourCatalogSpots()),
  ]);
  const live = [...liveAlong, ...liveCity];
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
    origin,
    destination,
  };
}

export async function suggestStopsAlongDrive(input: {
  origin?: RoutePoint | null;
  destination?: RoutePoint | null;
  mode?: TravelMode;
  durationHint?: string;
  preferRegions?: string[];
  text?: string;
}): Promise<DriveResult> {
  const mode = input.mode || "car";
  const filled = await fillEndsFromRegions(
    input.origin || null,
    input.destination || null,
    `${input.text || ""}\n${(input.preferRegions || []).join(" ")}`
  );
  if (
    filled.origin &&
    filled.destination &&
    (mode === "car" || mode === "traffic") &&
    isOutsideRoundTrip(filled.origin, filled.destination)
  ) {
    const round = await planGangwonRoundTrip(filled.origin, filled.destination, {
      mode,
      durationHint: input.durationHint,
      preferRegions: input.preferRegions,
      text: input.text,
    });
    if (round) return round;
  }
  return driveBetween({
    ...input,
    origin: filled.origin,
    destination: filled.destination,
    mode,
  });
}

export function spotsFromCorridor(picks: CorridorPick[]): Spot[] {
  return picks.map((p) => p.spot);
}
