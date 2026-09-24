import type { Spot } from "@/lib/data";
import { BRIDGE_REGIONS, QUIET_REGIONS } from "@/lib/prefs";

export type LatLng = { lat: number; lng: number };
export type TravelKind = "car" | "walk" | "bicycle" | "traffic";

export type CorridorPick = {
  spot: Spot;
  /** 도로(또는 중심)에서 벗어난 거리 km */
  distanceKm: number;
  /** 출발→도착 진행 비율. 주변 탐색이면 0 */
  t: number;
  /** 도로를 나갔다 돌아오는 대략의 추가 km */
  insertionKm: number;
  /** 적합 점수. 클수록 이 경로에 넣기 좋음 */
  utility: number;
};

export type RouteFit = {
  kind: "corridor" | "nearby" | "none";
  routeKm: number;
  deviationCapKm: number;
  stopBudget: number;
  picks: CorridorPick[];
};

const QUIET = new Set<string>(QUIET_REGIONS);
const BRIDGE = new Set<string>(BRIDGE_REGIONS);

function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function nightsOf(durationHint?: string) {
  const t = durationHint || "";
  if (/2\s*박/.test(t)) return 2;
  if (/1\s*박|하룻밤/.test(t)) return 1;
  return 0;
}

function stopBudget(routeKm: number, mode: TravelKind, durationHint?: string) {
  const nights = nightsOf(durationHint);
  if (mode === "walk") return clamp(Math.round(routeKm / 3) + nights, 1, 4);
  if (mode === "bicycle") return clamp(Math.round(routeKm / 12) + nights, 1, 5);
  const base = routeKm < 45 ? 2 : routeKm < 140 ? 3 : 4;
  return clamp(base + nights, 2, 6);
}

/** 경로 길이에 비례하되 상한을 둬서, 먼 우회가 거리만 보고 통과하지 않게 함 */
function deviationCapKm(routeKm: number, mode: TravelKind) {
  if (mode === "walk") return clamp(routeKm * 0.18, 1.2, 4);
  if (mode === "bicycle") return clamp(routeKm * 0.12, 2, 8);
  return clamp(routeKm * 0.065, 8, 22);
}

function spotQuality(spot: Spot) {
  const blob = `${spot.name} ${spot.theme} ${spot.description}`;
  if (/주차장|휴게소|정류장|화장실|주유소/.test(blob)) return -2;
  if (/박물관|미술관|해변|해수욕|국립|사찰|폭포|온천|관광지|체험관|테마|전망대|수목원|식물원|동굴|동물원|케이블/.test(blob)) {
    return 3.4;
  }
  if (/공원|계곡|호수|시장|문화|폭포|산악|리조트|스키|둘레길/.test(blob)) return 2.1;
  if (/(골|길|못|교|마을)$/.test(spot.name) && spot.name.length <= 8) return 0.15;
  if (spot.theme === "관광") return 1.8;
  return 1;
}

function themeUtility(spot: Spot, prefer: Set<string>) {
  let u = spotQuality(spot);
  if (QUIET.has(spot.region)) u += 0.8;
  else if (BRIDGE.has(spot.region)) u += 0.45;
  if (prefer.has(spot.region)) u += 1.6;
  return u;
}

type Measured = CorridorPick & { cap: number };

function measureOnLine(
  spots: Spot[],
  polyline: LatLng[],
  mode: TravelKind,
  prefer: Set<string>,
  ends: LatLng[]
): { measured: Measured[]; routeKm: number; cap: number } {
  const cum = [0];
  for (let i = 1; i < polyline.length; i++) {
    cum[i] = cum[i - 1] + haversineKm(polyline[i - 1], polyline[i]);
  }
  const routeKm = cum[cum.length - 1] || 0;
  const cap = deviationCapKm(Math.max(routeKm, 1), mode);
  const step = Math.max(1, Math.floor(polyline.length / 180));
  const samples: number[] = [];
  for (let i = 0; i < polyline.length; i += step) samples.push(i);
  if (samples[samples.length - 1] !== polyline.length - 1) samples.push(polyline.length - 1);

  const endPad = mode === "walk" ? 1.2 : mode === "bicycle" ? 2.5 : 6;
  const measured: Measured[] = [];
  for (const spot of spots) {
    if (!Number.isFinite(spot.lat) || !Number.isFinite(spot.lng)) continue;
    if (ends.some((e) => haversineKm(spot, e) < endPad)) continue;
    let best = Infinity;
    let bestI = 0;
    for (const i of samples) {
      const d = haversineKm(spot, polyline[i]);
      if (d < best) {
        best = d;
        bestI = i;
      }
    }
    const preferHit = prefer.has(spot.region);
    const allowed = preferHit ? Math.min(cap * 1.55, mode === "car" || mode === "traffic" ? 36 : cap * 1.4) : cap;
    if (best > allowed) continue;
    const t = routeKm > 0 ? cum[bestI] / routeKm : 0;
    const insertionKm = best * 2;
    const utility = themeUtility(spot, prefer) - insertionKm / Math.max(allowed, 1);
    measured.push({
      spot,
      distanceKm: best,
      t,
      insertionKm,
      utility,
      cap: allowed,
    });
  }
  return { measured, routeKm, cap };
}

function selectChain(pool: Measured[], budget: number, minGap: number): CorridorPick[] {
  if (!pool.length || budget < 1) return [];
  const items = [...pool].sort((a, b) => a.t - b.t || b.utility - a.utility);
  const regionKinds = new Set(items.map((p) => p.spot.region)).size;
  const n = items.length;
  const maxK = Math.min(budget, n);
  const dp: number[][] = Array.from({ length: n }, () => Array(maxK + 1).fill(-1e9));
  const prev: number[][] = Array.from({ length: n }, () => Array(maxK + 1).fill(-1));

  for (let i = 0; i < n; i++) dp[i][1] = items[i].utility;
  for (let k = 2; k <= maxK; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) {
        const sameRegion = items[i].spot.region === items[j].spot.region;
        const gapNeed = sameRegion && regionKinds <= 2 ? Math.min(minGap, 0.035) : minGap;
        if (items[i].t - items[j].t < gapNeed) continue;
        if (sameRegion && regionKinds > 2) continue;
        if (sameRegion && haversineKm(items[i].spot, items[j].spot) < 5) continue;
        const score = dp[j][k - 1] + items[i].utility;
        if (score > dp[i][k]) {
          dp[i][k] = score;
          prev[i][k] = j;
        }
      }
    }
  }

  let best = -1e9;
  let bestI = -1;
  let bestK = 1;
  for (let k = 1; k <= maxK; k++) {
    for (let i = 0; i < n; i++) {
      if (dp[i][k] > best) {
        best = dp[i][k];
        bestI = i;
        bestK = k;
      }
    }
  }
  if (bestI < 0 || best < 0) return [];

  const chain: Measured[] = [];
  let i = bestI;
  let k = bestK;
  while (i >= 0 && k >= 1) {
    chain.push(items[i]);
    const p = prev[i][k];
    i = p;
    k -= 1;
  }
  return chain.reverse().map(({ cap: _cap, ...pick }) => pick);
}

function pickNearby(
  spots: Spot[],
  center: LatLng,
  mode: TravelKind,
  prefer: Set<string>,
  budget: number
): CorridorPick[] {
  const cap = mode === "walk" ? 4 : mode === "bicycle" ? 10 : 18;
  const ranked: CorridorPick[] = [];
  for (const spot of spots) {
    if (!Number.isFinite(spot.lat) || !Number.isFinite(spot.lng)) continue;
    const d = haversineKm(center, spot);
    const allowed = prefer.has(spot.region) ? cap * 1.4 : cap;
    if (d > allowed || d < 0.4) continue;
    ranked.push({
      spot,
      distanceKm: d,
      t: 0,
      insertionKm: d,
      utility: themeUtility(spot, prefer) - d / allowed,
    });
  }
  ranked.sort((a, b) => b.utility - a.utility);
  const chosen: CorridorPick[] = [];
  const used = new Map<string, number>();
  const local = new Set(ranked.map((p) => p.spot.region)).size <= 2;
  const perRegion = local ? 3 : 1;
  for (const pick of ranked) {
    if (chosen.length >= budget) break;
    const count = used.get(pick.spot.region) || 0;
    if (count >= perRegion) continue;
    if (
      chosen.some(
        (c) => haversineKm(c.spot, pick.spot) < (mode === "walk" ? 0.6 : local ? 1.6 : 4)
      )
    ) {
      continue;
    }
    chosen.push(pick);
    used.set(pick.spot.region, count + 1);
  }
  return chosen;
}

/**
 * 경로 적합 모델.
 * 각 명소를 최단 도로에 끼워 넣을 때의 우회(왕복 이탈)로 점수를 매기고,
 * 진행 방향이 뒤집히지 않는 연쇄를 동적 계획으로 고른다.
 * 구간이 짧거나 도로가 없으면 중심 반경 탐색으로 바뀐다.
 */
export function fitRouteStops(input: {
  spots: Spot[];
  polyline?: LatLng[];
  origin?: LatLng | null;
  destination?: LatLng | null;
  mode?: TravelKind;
  durationHint?: string;
  preferRegions?: string[];
}): RouteFit {
  const mode = input.mode || "car";
  const prefer = new Set((input.preferRegions || []).filter(Boolean));
  const line = (input.polyline || []).filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
  const ends = [input.origin, input.destination].filter(
    (p): p is LatLng => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );

  if (line.length >= 2) {
    const { measured, routeKm, cap } = measureOnLine(
      input.spots,
      line,
      mode,
      prefer,
      ends
    );
    const budget = stopBudget(routeKm, mode, input.durationHint);
    if (routeKm < 28) {
      const center = line[Math.floor(line.length / 2)];
      const picks = pickNearby(input.spots, center, mode, prefer, Math.min(budget, 3));
      return {
        kind: picks.length ? "nearby" : "none",
        routeKm,
        deviationCapKm: cap,
        stopBudget: budget,
        picks,
      };
    }
    const margin = clamp(8 / Math.max(routeKm, 1), 0.03, 0.12);
    const windowed = measured.filter((p) => p.t >= margin && p.t <= 1 - margin);
    const gap = clamp(16 / Math.max(routeKm, 1), 0.06, 0.22);
    const picks = selectChain(windowed, budget, gap);
    return {
      kind: picks.length ? "corridor" : "none",
      routeKm,
      deviationCapKm: cap,
      stopBudget: budget,
      picks,
    };
  }

  if (!ends.length) {
    return { kind: "none", routeKm: 0, deviationCapKm: 0, stopBudget: 0, picks: [] };
  }
  const center = {
    lat: ends.reduce((s, p) => s + p.lat, 0) / ends.length,
    lng: ends.reduce((s, p) => s + p.lng, 0) / ends.length,
  };
  const picks = pickNearby(input.spots, center, mode, prefer, mode === "walk" ? 2 : 3);
  return {
    kind: picks.length ? "nearby" : "none",
    routeKm: 0,
    deviationCapKm: mode === "walk" ? 4 : 18,
    stopBudget: picks.length,
    picks,
  };
}
