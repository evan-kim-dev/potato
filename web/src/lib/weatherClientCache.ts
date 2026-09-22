/** 클라이언트 공용 단기 캐시 — 날씨 중복 fetch 완화 */

const WX_KEY = "gw_wx_cache_v1";
const TTL_MS = 5 * 60 * 1000;

type WxCache = {
  at: number;
  cities: unknown;
};

export function readWeatherCache(): unknown[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(WX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WxCache;
    if (!parsed?.at || Date.now() - parsed.at > TTL_MS) return null;
    return Array.isArray(parsed.cities) ? parsed.cities : null;
  } catch {
    return null;
  }
}

export function writeWeatherCache(cities: unknown[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      WX_KEY,
      JSON.stringify({ at: Date.now(), cities } satisfies WxCache)
    );
  } catch {
    /* ignore quota */
  }
}

export async function fetchWeatherCached(opts?: {
  force?: boolean;
}): Promise<unknown[] | null> {
  if (!opts?.force) {
    const hit = readWeatherCache();
    if (hit) return hit;
  }
  const res = await fetch("/api/weather");
  if (!res.ok) return null;
  const data = await res.json();
  const cities = Array.isArray(data.cities) ? data.cities : null;
  if (cities) writeWeatherCache(cities);
  return cities;
}
