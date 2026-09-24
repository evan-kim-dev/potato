import { existsSync, readFileSync } from "fs";
import path from "path";
import { QUIET_REGIONS, dispersionTargetsFor } from "@/lib/prefs";
import { SPOT_IMAGE_ALIASES, SPOT_IMAGE_OVERRIDES } from "@/lib/spotImages";
import {
  REGION_PROFILES,
  regionProfile,
  regionShortName,
} from "@/lib/regionProfiles";

export type Spot = {
  name: string;
  region: string;
  description: string;
  lat: number;
  lng: number;
  theme: string;
  tip?: string;
  hours?: string;
  fee?: string;
  parking?: string;
  best_time?: string;
  image?: string;
};

export type City = {
  city: string;
  lat: number;
  lng: number;
  pop_rank?: number;
};

export type Beach = {
  beach_num: number;
  name: string;
  full_name: string;
  address?: string;
  region: string;
  lat: number;
  lng: number;
  coast?: string;
  weather?: BeachWeather | null;
};

export type BeachWeather = {
  temp_c?: number | null;
  cond?: string;
  label?: string;
  wind_ms?: number | null;
  wave_m?: number | null;
  pop?: number | null;
  tide?: unknown[];
  sun?: { sunrise?: string; sunset?: string };
};

export type Festival = {
  id: string;
  title: string;
  addr?: string;
  image?: string;
  tel?: string;
  place: string;
  period: string;
  desc?: string;
  eventStartDate?: string;
  eventEndDate?: string;
  mapX?: string;
  mapY?: string;
};

export type RegionTip = {
  region: string;
  short: string;
  headline: string;
  tagline: string;
  pop: string;
  specialty: string;
  highlight: string;
  quiet: boolean;
  officialUrl: string;
  photo?: { image: string; title: string };
  themes: string[];
  spots: string[];
  spotCount: number;
  festival?: { title: string; period: string };
  beaches: string[];
  dispersion: string[];
  /** 혼잡 프록시: high | mid | low | unknown */
  congestionLevel?: string;
  congestionLabel?: string;
  congestionProxy?: boolean;
};

export type ForecastMsgPayload = {
  stub?: boolean;
  reason?: string;
  updated_at?: string | null;
  attribution?: {
    license?: string;
    author?: string;
    source_name?: string;
    source_url?: string;
    notice?: string;
  };
  situation: Array<{ label: string; stnId?: string; data: Record<string, unknown> | null }>;
  land: Array<{ label: string; regId?: string; data: Record<string, unknown> | null }>;
  sea: Array<{ label: string; regId?: string; data: Record<string, unknown> | null }>;
};

function dataPath(...parts: string[]) {
  const candidates = [
    path.join(process.cwd(), "data", ...parts),
    path.join(process.cwd(), "..", "backend", "data", ...parts),
    path.join(process.cwd(), "backend", "data", ...parts),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

const jsonCache = new Map<string, unknown>();

function readJson<T>(file: string): T {
  if (jsonCache.has(file)) return jsonCache.get(file) as T;
  const data = JSON.parse(readFileSync(dataPath(file), "utf-8")) as T;
  jsonCache.set(file, data);
  return data;
}

let spotsCache: Spot[] | null = null;
let spotsByRegionCache: Map<string, Spot[]> | null = null;
let citiesCache: City[] | null = null;
let beachesCache: Beach[] | null = null;
let coastalCache: string[] | null = null;
let festivalsCache: Festival[] | null = null;
let festivalsByPlaceCache: Map<string, Festival> | null = null;
let forecastCache: ForecastMsgPayload | null = null;
let beachWeatherCache: Beach[] | null = null;
let imageCatalog: Array<{ region: string; name: string; image: string }> | null =
  null;
let imageByRegion: Map<string, Array<{ name: string; image: string }>> | null =
  null;
let regionPhotoCache: Map<string, RegionTip["photo"] | undefined> | null = null;
let tipsMapCache: Record<string, RegionTip> | null = null;

function preferHttps(url: string) {
  let out = url.startsWith("http://") ? `https://${url.slice(7)}` : url;
  // VisitKorea cms2 paths often 404 on .jpeg but serve .jpg
  if (/\/cms2\/website\/\d+\/\d+\.jpeg$/i.test(out)) {
    out = out.replace(/\.jpeg$/i, ".jpg");
  }
  return out;
}

function normTitle(s: string) {
  return s.toLowerCase().replace(/[^0-9a-z가-힣]/gi, "");
}

function significantTokens(text: string): string[] {
  const raw = text.match(/[가-힣]{2,}|[a-z0-9]{3,}/gi) || [];
  const out: string[] = [];
  for (const t of raw) {
    const n = normTitle(t);
    if (n.length >= 2 && !out.includes(n)) out.push(n);
  }
  return out;
}

function buildImageCatalog() {
  if (imageCatalog) return imageCatalog;
  const rows: Array<{ region: string; name: string; image: string }> = [];
  const push = (region: string, name: string, image?: string) => {
    if (!region || !name || !image) return;
    rows.push({ region, name, image: preferHttps(image.trim()) });
  };

  try {
    const agg = readJson<{
      regions?: Record<string, Array<{ name?: string; imageUrl?: string }>>;
    }>("kto_aggregated_spots.json");
    for (const [region, entries] of Object.entries(agg.regions || {})) {
      for (const e of entries) push(region, e.name || "", e.imageUrl);
    }
  } catch {
    /* optional */
  }

  try {
    const kor = readJson<{
      regions?: Record<string, Array<{ title?: string; image?: string }>>;
    }>("tour_kor_spots.json");
    for (const [region, entries] of Object.entries(kor.regions || {})) {
      for (const e of entries) push(region, e.title || "", e.image);
    }
  } catch {
    /* optional */
  }

  try {
    const eco = readJson<{
      regions?: Record<string, Array<{ title?: string; image?: string }>>;
    }>("tour_eco_spots.json");
    for (const [region, entries] of Object.entries(eco.regions || {})) {
      for (const e of entries) push(region, e.title || "", e.image);
    }
  } catch {
    /* optional */
  }

  try {
    const photos = readJson<{
      regions?: Record<
        string,
        Array<{ title?: string; keyword?: string; image?: string }>
      >;
    }>("tour_region_photos.json");
    for (const [region, entries] of Object.entries(photos.regions || {})) {
      for (const e of entries) {
        push(region, `${e.title || ""} ${e.keyword || ""}`.trim(), e.image);
      }
    }
  } catch {
    /* optional */
  }

  imageCatalog = rows;
  imageByRegion = new Map();
  for (const row of rows) {
    const list = imageByRegion.get(row.region) || [];
    list.push({ name: row.name, image: row.image });
    imageByRegion.set(row.region, list);
  }
  return rows;
}

function scoreImageCandidate(
  spot: Spot,
  candidateName: string,
  candidateRegion: string,
  keys: string[]
) {
  const nn = normTitle(candidateName);
  if (!nn) return 0;
  let score = 0;
  for (const key of keys) {
    const k = normTitle(key);
    if (!k || k.length < 2) continue;
    if (nn === k) score = Math.max(score, 100);
    else if (nn.includes(k) || k.includes(nn)) score = Math.max(score, 86);
    else if (k.length >= 3 && nn.includes(k)) score = Math.max(score, 78);
  }
  if (!score) return 0;
  if (candidateRegion === spot.region) score += 8;
  // Penalize ultra-generic / frequently-misassigned hub fillers
  if (/시장|카지노|콘도|리조트|아우라지|설악산/.test(candidateName) && score < 95) {
    score -= 25;
  }
  // Region mismatch on weak token hits → drop below threshold
  if (candidateRegion && spot.region && candidateRegion !== spot.region && score < 95) {
    score -= 20;
  }
  return score;
}

function resolveSpotImage(spot: Spot): string | undefined {
  const override = SPOT_IMAGE_OVERRIDES[spot.name];
  if (override) return preferHttps(override);

  const keys = [
    ...(SPOT_IMAGE_ALIASES[spot.name] || []),
    ...significantTokens(spot.name),
  ];
  if (!keys.length) return undefined;

  buildImageCatalog();
  const regional = imageByRegion?.get(spot.region) || [];
  let best: { score: number; image: string } | null = null;
  for (const row of regional) {
    const score = scoreImageCandidate(spot, row.name, spot.region, keys);
    if (score < 80) continue;
    if (!best || score > best.score) best = { score, image: row.image };
    if (best.score >= 100) return best.image;
  }
  // 지역 내에서 못 찾으면 전체 카탈로그 (비용↑) — 약한 매칭만
  if (!best) {
    for (const row of imageCatalog || []) {
      if (row.region === spot.region) continue;
      const score = scoreImageCandidate(spot, row.name, row.region, keys);
      if (score < 95) continue;
      if (!best || score > best.score) best = { score, image: row.image };
    }
  }
  return best?.image;
}

function enrichSpots(spots: Spot[]): Spot[] {
  return spots.map((s) => ({
    ...s,
    image: s.image || resolveSpotImage(s),
  }));
}

let tourCatalogCache: Spot[] | null = null;

/** TourAPI 동기화 좌표. 일정 목업 spots.json 과 별개 */
export function getTourCatalogSpots(): Spot[] {
  if (tourCatalogCache) return tourCatalogCache;
  const out: Spot[] = [];
  try {
    const kor = readJson<{
      regions?: Record<
        string,
        Array<{ title?: string; addr?: string; mapX?: string; mapY?: string }>
      >;
    }>("tour_kor_spots.json");
    for (const [region, entries] of Object.entries(kor.regions || {})) {
      for (const e of entries || []) {
        const lat = Number(e.mapY);
        const lng = Number(e.mapX);
        const name = (e.title || "").trim();
        if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        out.push({
          name,
          region,
          description: e.addr || region,
          lat,
          lng,
          theme: "관광",
        });
      }
    }
  } catch {
    /* catalog optional */
  }
  tourCatalogCache = out;
  return out;
}

export function getSpots(): Spot[] {
  if (!spotsCache) {
    const byKey = new Map<string, Spot>();
    for (const s of getTourCatalogSpots()) {
      byKey.set(`${s.region}|${s.name}`, s);
    }
    for (const s of enrichSpots(readJson<Spot[]>("spots.json"))) {
      const key = `${s.region}|${s.name}`;
      const prev = byKey.get(key);
      byKey.set(
        key,
        prev
          ? {
              ...prev,
              ...s,
              lat: Number.isFinite(s.lat) ? s.lat : prev.lat,
              lng: Number.isFinite(s.lng) ? s.lng : prev.lng,
              description: s.description || prev.description,
              image: s.image || prev.image,
            }
          : s
      );
    }
    spotsCache = enrichSpots([...byKey.values()]);
    spotsByRegionCache = new Map();
    for (const s of spotsCache) {
      const list = spotsByRegionCache.get(s.region) || [];
      list.push(s);
      spotsByRegionCache.set(s.region, list);
    }
  }
  return spotsCache;
}

function spotsInRegion(region: string): Spot[] {
  getSpots();
  return spotsByRegionCache?.get(region) || [];
}

export function getCities(): City[] {
  if (!citiesCache) {
    const catalog = readJson<{ cities: City[] }>("catalog.json");
    citiesCache = catalog.cities || [];
  }
  return citiesCache;
}

export function getFeaturedBeaches(): Beach[] {
  if (!beachesCache) {
    const raw = readJson<{ featured?: Beach[]; coastal_regions?: string[] }>(
      "gangwon_beaches.json"
    );
    beachesCache = raw.featured || [];
    coastalCache = raw.coastal_regions || [];
  }
  return beachesCache;
}

export function getCoastalRegions(): string[] {
  if (!coastalCache) getFeaturedBeaches();
  return coastalCache || [];
}

export function getBeachRows(): Beach[] {
  if (beachWeatherCache) return beachWeatherCache;
  try {
    const raw = readJson<{ beaches?: Beach[] }>("tour_beach_weather.json");
    if (raw.beaches?.length) {
      beachWeatherCache = raw.beaches;
      return beachWeatherCache;
    }
  } catch {
    /* fall through */
  }
  beachWeatherCache = getFeaturedBeaches();
  return beachWeatherCache;
}

export function getFestivals(): Festival[] {
  if (!festivalsCache) {
    const raw = readJson<{ items?: Festival[]; regions?: Record<string, Festival[]> }>(
      "tour_kor_festivals.json"
    );
    if (raw.items?.length) festivalsCache = raw.items;
    else {
      const flat: Festival[] = [];
      for (const list of Object.values(raw.regions || {})) flat.push(...list);
      festivalsCache = flat;
    }
    festivalsByPlaceCache = new Map();
    for (const f of festivalsCache) {
      if (f.place && !festivalsByPlaceCache.has(f.place)) {
        festivalsByPlaceCache.set(f.place, f);
      }
    }
  }
  return festivalsCache;
}

function festivalForRegion(region: string): Festival | undefined {
  getFestivals();
  const short = regionShortName(region);
  return (
    festivalsByPlaceCache?.get(region) ||
    [...(festivalsByPlaceCache?.entries() || [])].find(([place]) =>
      place.includes(short)
    )?.[1]
  );
}

export function getForecastMsg(): ForecastMsgPayload {
  if (!forecastCache) forecastCache = readJson<ForecastMsgPayload>("forecast_msg.json");
  return forecastCache;
}

export function getThemes(spots: Spot[] = getSpots()): string[] {
  return [...new Set(spots.map((s) => s.theme).filter(Boolean))].sort();
}

export function getQuietGems(limit = 6): Spot[] {
  const quietRegions = new Set<string>(QUIET_REGIONS);
  const spots = getSpots().filter((s) => quietRegions.has(s.region));
  const pool = spots.length ? spots : getSpots();
  const day = Math.floor(Date.now() / 86_400_000);
  const scored = pool.map((s) => {
    let score = quietRegions.has(s.region) ? 12 : 2;
    const blob = `${s.name} ${s.description || ""} ${s.theme || ""}`;
    if (s.image) score += 5;
    if (/숲|계곡|동굴|휴양|자작|둘레|산책|생태|한산|온천|사찰|박물관/.test(blob)) {
      score += 4;
    }
    if (/리조트|카지노|콘도|아울렛/.test(blob)) score -= 6;
    // 일일 로테이션: 같은 날엔 안정, 날짜가 바뀌면 순위 살짝 흔들림
    score += ((s.name.length * 17 + s.region.length * 31 + day * 13) % 7) - 3;
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name, "ko"));
  // 권역 다양성: 연속 동일 시군 최소화
  const picked: Spot[] = [];
  const usedRegion = new Map<string, number>();
  for (const row of scored) {
    if (picked.length >= limit) break;
    const used = usedRegion.get(row.s.region) || 0;
    if (used >= 2 && scored.length > limit) continue;
    picked.push(row.s);
    usedRegion.set(row.s.region, used + 1);
  }
  if (picked.length < limit) {
    for (const row of scored) {
      if (picked.length >= limit) break;
      if (!picked.some((p) => p.name === row.s.name)) picked.push(row.s);
    }
  }
  return picked;
}

export function spotsMatchingPrompt(prompt: string, limit = 8): Spot[] {
  const q = prompt.toLowerCase();
  const quietSet = new Set<string>(QUIET_REGIONS);
  const coastalHot =
    /강릉|속초|경포|설악|서피|핫플|인기|해수욕|피서|양양\s*서핑/.test(prompt) &&
    !/한산|숨은|조용|저밀도|분산|소외|인구/.test(prompt);
  const preferQuiet = !coastalHot;
  const wantEco = /친환경|생태|그린|숲길|걷기|두루누비/.test(prompt);
  const congMap = getRegionCongestionMap();

  const scored = getSpots()
    .map((s) => {
      let score = 0;
      const blob = `${s.name} ${s.region} ${s.description} ${s.theme}`.toLowerCase();
      if (prompt.includes(s.region.replace(/(시|군)$/, ""))) score += 5;
      if (prompt.includes(s.region)) score += 6;
      if (blob.includes(q.slice(0, 8))) score += 2;
      for (const token of [
        "바다",
        "해변",
        "산",
        "숲",
        "카페",
        "트레킹",
        "힐링",
        "야경",
        "생태",
        "친환경",
        "동굴",
        "계곡",
      ]) {
        if (prompt.includes(token) && blob.includes(token)) score += 3;
      }

      // 블루오션: 혼잡 low 가점, high 감점
      const cong = congMap[s.region]?.level;
      if (cong === "low") score += 4;
      else if (cong === "high") score -= preferQuiet ? 5 : 1;
      else if (cong === "mid") score += 1;

      if (wantEco && /숲|계곡|생태|둘레|산책|휴양|자작/.test(blob)) score += 4;

      if (preferQuiet) {
        if (quietSet.has(s.region)) score += 6;
        if (/숲|계곡|동굴|휴양|자작|둘레|산책|생태|한산/.test(blob)) score += 2;
        if (/강릉시|속초시|양양군/.test(s.region)) score -= 4;
      } else {
        if (quietSet.has(s.region)) score += 2;
      }

      if (preferQuiet && quietSet.has(s.region) && score < 2) {
        score += 1 + Math.floor(Math.random() * 3);
      }
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || Math.random() - 0.5);

  if (scored.length) {
    const picks = scored.map((x) => x.s);
    if (preferQuiet) {
      const quietFirst = picks.filter((s) => quietSet.has(s.region));
      const rest = picks.filter((s) => !quietSet.has(s.region));
      return [...quietFirst, ...rest].slice(0, limit);
    }
    // 해안 핫플 요청: 절반은 요청 매칭, 나머지는 한산 분산
    const hot = picks.filter((s) => !quietSet.has(s.region)).slice(0, Math.ceil(limit / 2));
    const quiet = picks.filter((s) => quietSet.has(s.region));
    const quietPad = getSpots().filter((s) => quietSet.has(s.region));
    const mixed = [...hot];
    for (const s of [...quiet, ...quietPad]) {
      if (mixed.length >= limit) break;
      if (!mixed.some((m) => m.name === s.name)) mixed.push(s);
    }
    return mixed.slice(0, limit);
  }

  const quietPool = getSpots().filter((s) => quietSet.has(s.region));
  return (quietPool.length ? quietPool : getSpots()).slice(0, limit);
}

function regionPhoto(region: string): RegionTip["photo"] | undefined {
  if (!regionPhotoCache) {
    regionPhotoCache = new Map();
    try {
      const raw = readJson<{
        regions?: Record<string, Array<{ title?: string; image?: string }>>;
      }>("tour_region_photos.json");
      for (const [reg, entries] of Object.entries(raw.regions || {})) {
        const row = entries?.[0];
        regionPhotoCache.set(
          reg,
          row?.image
            ? { image: preferHttps(row.image.trim()), title: row.title || reg }
            : undefined
        );
      }
    } catch {
      /* optional */
    }
  }
  if (regionPhotoCache.has(region)) return regionPhotoCache.get(region);
  return undefined;
}

function proxyCongestion(region: string): {
  level: string;
  label: string;
  proxy?: boolean;
} {
  const quiet = new Set<string>(QUIET_REGIONS).has(region);
  if (quiet) return { level: "low", label: "한산·여유", proxy: true };
  if (/강릉|속초|양양|동해|삼척/.test(region))
    return { level: "high", label: "혼잡 우려", proxy: true };
  return { level: "mid", label: "보통", proxy: true };
}

/** 인사이트 파일이 거의 한 등급이면 판단 근거로 쓰지 않음 (현재 전 권역 high) */
function insightsTrustworthy(): boolean {
  try {
    const raw = readJson<{
      regions?: Record<string, { congestion_level?: string }>;
    }>("tour_regional_insights.json");
    const levels = Object.values(raw.regions || {})
      .map((r) => r.congestion_level)
      .filter(Boolean) as string[];
    if (levels.length < 8) return false;
    const counts = new Map<string, number>();
    for (const level of levels) counts.set(level, (counts.get(level) || 0) + 1);
    const top = Math.max(...counts.values());
    return top / levels.length < 0.8;
  } catch {
    return false;
  }
}

function regionCongestion(region: string): {
  level: string;
  label: string;
  proxy?: boolean;
} {
  if (!insightsTrustworthy()) return proxyCongestion(region);
  try {
    const raw = readJson<{
      regions?: Record<
        string,
        {
          congestion_level?: string;
          label?: string;
          proxy?: boolean;
        }
      >;
    }>("tour_regional_insights.json");
    const row = raw.regions?.[region];
    if (row?.congestion_level) {
      return {
        level: row.congestion_level,
        label: row.label || row.congestion_level,
        proxy: row.proxy,
      };
    }
  } catch {
    /* fall through */
  }
  return proxyCongestion(region);
}

export function getRegionCongestionMap(): Record<
  string,
  { level: string; label: string; proxy?: boolean }
> {
  const map: Record<string, { level: string; label: string; proxy?: boolean }> = {};
  for (const region of Object.keys(REGION_PROFILES)) {
    map[region] = regionCongestion(region);
  }
  return map;
}

function regionDispersion(region: string): string[] {
  const fromMap = dispersionTargetsFor(region).map((r) => regionShortName(r));
  try {
    const raw = readJson<{
      regions?: Record<
        string,
        { dispersion_targets?: Array<{ region?: string; level?: string }> }
      >;
    }>("tour_regional_insights.json");
    const targets = raw.regions?.[region]?.dispersion_targets || [];
    const fromData = targets
      .slice(0, 3)
      .map((t) => {
        const name = regionShortName(t.region || "");
        return name ? `${name}${t.level ? `(${t.level})` : ""}` : "";
      })
      .filter(Boolean);
    if (fromData.length) return fromData;
  } catch {
    /* fall through */
  }
  return fromMap;
}

export function getRegionTip(region: string): RegionTip {
  const profile = regionProfile(region);
  const spots = spotsInRegion(region);
  const themes = [...new Set(spots.map((s) => s.theme).filter(Boolean))].slice(0, 3);
  const fest = festivalForRegion(region);
  const short = regionShortName(region);
  const quiet = new Set<string>(QUIET_REGIONS).has(region);
  const beaches = quiet
    ? []
    : getBeachRows()
        .filter((b) => regionShortName(b.region || "") === short)
        .slice(0, 3)
        .map((b) => b.name || b.full_name)
        .filter(Boolean);

  const disperseRegs = dispersionTargetsFor(region);
  const disperseSpots =
    !quiet && disperseRegs.length
      ? disperseRegs
          .flatMap((r) => spotsInRegion(r))
          .slice(0, 3)
          .map((s) => `${s.name}(${regionShortName(s.region)})`)
      : [];

  const cong = regionCongestion(region);

  return {
    region,
    short,
    headline: profile.headline,
    tagline: profile.tagline,
    pop: profile.pop,
    specialty: profile.specialty,
    highlight: profile.highlight,
    quiet,
    officialUrl: profile.officialUrl,
    photo: regionPhoto(region),
    themes,
    spots: quiet
      ? spots.slice(0, 3).map((s) => s.name)
      : disperseSpots.length
        ? disperseSpots
        : spots.slice(0, 3).map((s) => s.name),
    spotCount: quiet ? spots.length : disperseSpots.length || spots.length,
    festival: fest
      ? { title: fest.title, period: fest.period || "" }
      : undefined,
    beaches,
    dispersion: regionDispersion(region),
    congestionLevel: cong.level,
    congestionLabel: cong.label,
    congestionProxy: cong.proxy,
  };
}

export function getRegionTipsMap(): Record<string, RegionTip> {
  if (tipsMapCache) return tipsMapCache;
  const map: Record<string, RegionTip> = {};
  for (const region of Object.keys(REGION_PROFILES)) {
    map[region] = getRegionTip(region);
  }
  tipsMapCache = map;
  return map;
}
