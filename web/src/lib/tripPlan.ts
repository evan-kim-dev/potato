import { spotsMatchingPrompt, type Spot } from "@/lib/data";
import {
  expandAdjacentRegions,
  pickDefaultRegionCluster,
  regionsMentionedInText,
} from "@/lib/prefs";
import type { PlanStep } from "@/lib/tripTypes";

/** 요청마다 후보 순서를 가볍게 섞되, 권역 클러스터는 유지 */
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
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

function hopsForDuration(prompt: string, durationHint?: string): number {
  const t = `${prompt} ${durationHint || ""}`;
  if (/2\s*박\s*3\s*일|2\s*박/.test(t)) return 2;
  if (/1\s*박\s*2\s*일|1\s*박|하룻밤/.test(t)) return 1;
  return 1;
}

/**
 * 후보 스팟 — 언급·도착 권역 + 인접지만 모음.
 * 강원 전역을 섞지 않아 뺑뺑이 코스를 막음.
 */
export function candidateSpotsForPlan(
  prompt: string,
  prefs = "",
  extra?: { placeNote?: string; durationHint?: string }
): Spot[] {
  const full = prefs ? `${prompt}\n(취향: ${prefs})` : prompt;
  const place = extra?.placeNote || "";
  const mentioned = regionsMentionedInText(prompt, prefs, place);
  const hops = hopsForDuration(prompt, extra?.durationHint);
  const seeds =
    mentioned.length > 0 ? mentioned : pickDefaultRegionCluster(`${prompt}|${prefs}|${place}`);
  const cluster = expandAdjacentRegions(seeds, hops);

  const matched = spotsMatchingPrompt(full, 48);
  let catalog = matched.filter((s) => cluster.has(s.region));

  // 클러스터가 너무 비면 인접 1홉 더
  if (catalog.length < 4) {
    const wider = expandAdjacentRegions([...seeds], hops + 1);
    catalog = matched.filter((s) => wider.has(s.region));
  }
  if (catalog.length < 4) catalog = matched.slice(0, 36);

  // 클러스터 중심(언급 권역 평균)에 가까운 순 + 가벼운 셔플
  const focusSpots = catalog.filter((s) => seeds.includes(s.region));
  let anchor: { lat: number; lng: number };
  if (focusSpots.length) {
    anchor = {
      lat: focusSpots.reduce((sum, s) => sum + s.lat, 0) / focusSpots.length,
      lng: focusSpots.reduce((sum, s) => sum + s.lng, 0) / focusSpots.length,
    };
  } else {
    anchor = {
      lat: catalog.reduce((sum, s) => sum + s.lat, 0) / catalog.length,
      lng: catalog.reduce((sum, s) => sum + s.lng, 0) / catalog.length,
    };
  }

  const scored = catalog
    .map((s) => ({
      s,
      d: haversineKm(anchor, s),
      seedBonus: seeds.includes(s.region) ? 0 : 1,
    }))
    .sort((a, b) => a.seedBonus - b.seedBonus || a.d - b.d);

  const top = scored.slice(0, 28).map((x) => x.s);
  // 가까운 후보끼리만 살짝 섞기
  return shuffleInPlace(top);
}

export function inferDurationLabel(prompt: string): string {
  if (/2\s*박\s*3\s*일|2\s*박/.test(prompt)) return "2박 3일";
  if (/1\s*박\s*2\s*일|1\s*박|하룻밤/.test(prompt)) return "1박 2일";
  if (/반나절/.test(prompt)) return "반나절";
  if (/당일|하루\s*코스/.test(prompt)) return "당일 코스";
  return "";
}

function spotKey(name: string, region?: string) {
  return `${(name || "").replace(/\s/g, "")}|${(region || "").replace(/\s/g, "")}`;
}

/** Gemini가 고른 이름·권역을 카탈로그 Spot으로 매칭 */
export function resolveSpotsFromSelection(
  picks: Array<{ name?: string; region?: string }>,
  catalog: Spot[]
): Spot[] {
  const byExact = new Map(catalog.map((s) => [spotKey(s.name, s.region), s]));
  const byName = new Map<string, Spot[]>();
  for (const s of catalog) {
    const k = s.name.replace(/\s/g, "");
    const list = byName.get(k) || [];
    list.push(s);
    byName.set(k, list);
  }

  const out: Spot[] = [];
  const used = new Set<string>();
  for (const p of picks) {
    const name = (p.name || "").trim();
    if (!name) continue;
    let hit =
      byExact.get(spotKey(name, p.region || "")) ||
      byName.get(name.replace(/\s/g, ""))?.[0];
    if (!hit) {
      const n = name.replace(/\s/g, "");
      hit = catalog.find(
        (s) =>
          s.name.replace(/\s/g, "").includes(n) ||
          n.includes(s.name.replace(/\s/g, ""))
      );
    }
    if (!hit) continue;
    const id = spotKey(hit.name, hit.region);
    if (used.has(id)) continue;
    used.add(id);
    out.push(hit);
  }
  return out;
}

/** 좌표 기준 최근접 이웃으로 이동 거리 최소화 */
export function orderSpotsByProximity(
  spots: Spot[],
  start?: { lat: number; lng: number } | null
): Spot[] {
  if (spots.length <= 2) return [...spots];
  const remaining = [...spots];
  const ordered: Spot[] = [];

  let idx = 0;
  if (start && Number.isFinite(start.lat) && Number.isFinite(start.lng)) {
    let best = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(start, remaining[i]);
      if (d < best) {
        best = d;
        idx = i;
      }
    }
  } else {
    // 서쪽·북쪽부터 (강원 진입 방향에 가깝게)
    remaining.sort((a, b) => a.lng - b.lng || b.lat - a.lat);
    idx = 0;
  }

  let current = remaining.splice(idx, 1)[0];
  ordered.push(current);
  while (remaining.length) {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    current = remaining.splice(bestI, 1)[0];
    ordered.push(current);
  }
  return ordered;
}

/**
 * 일차별로 가까운 순 재배치.
 * 먼 점프(대략 70km+)가 남으면 해당 스팟을 일차 끝으로 미룸.
 */
export function orderPlanStepsByProximity(steps: PlanStep[]): PlanStep[] {
  if (steps.length <= 2) {
    return steps.map((s, i) => ({ ...s, order: i + 1 }));
  }

  const days = [...new Set(steps.map((s) => s.day))].sort((a, b) => a - b);
  const byDay = new Map<number, PlanStep[]>();
  for (const d of days) byDay.set(d, steps.filter((s) => s.day === d));

  const out: PlanStep[] = [];
  let prev: { lat: number; lng: number } | null = null;

  for (const d of days) {
    const daySteps = byDay.get(d) || [];
    const spots = daySteps.map((s) => s.spot as Spot);
    const orderedSpots = orderSpotsByProximity(spots, prev);
    const metaByKey = new Map(
      daySteps.map((s) => [spotKey(s.spot.name, s.spot.region), s])
    );
    for (const spot of orderedSpots) {
      const meta = metaByKey.get(spotKey(spot.name, spot.region));
      if (!meta) continue;
      out.push({ ...meta, spot: { ...meta.spot, ...spot }, day: d });
    }
    const last = orderedSpots[orderedSpots.length - 1];
    if (last) prev = { lat: last.lat, lng: last.lng };
  }

  return out.map((s, i) => ({ ...s, order: i + 1 }));
}
