"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { RegionTip } from "@/lib/data";
import { congestionHintForRegion } from "@/lib/impactScore";
import { QUIET_REGIONS } from "@/lib/prefs";
import type { WeatherCard } from "@/lib/weather";
import { fetchWeatherCached } from "@/lib/weatherClientCache";

const COASTAL_HOT = new Set(["강릉시", "속초시", "양양군", "동해시"]);

type LivePick = {
  from: RegionTip;
  to: RegionTip[];
  reason: string;
  level: "high" | "mid";
};

function clockLabel(d = new Date()) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function pickLive(
  tips: Record<string, RegionTip>,
  weatherByCity: Map<string, WeatherCard>
): LivePick | null {
  const quietSet = new Set<string>(QUIET_REGIONS);
  const scored = Object.values(tips).map((tip) => {
    const w =
      weatherByCity.get(tip.region) ||
      weatherByCity.get(tip.short) ||
      [...weatherByCity.values()].find((c) => c.city.includes(tip.short));
    const festCount = tip.festival ? 1 : 0;
    const live = congestionHintForRegion({
      region: tip.region,
      isQuiet: quietSet.has(tip.region) || tip.quiet,
      isCoastalHot: COASTAL_HOT.has(tip.region),
      festivalCount: festCount,
      weatherLabel: w?.label,
    });
    // 정적 힌트와 라이브 점수 중 더 혼잡한 쪽을 우선
    const staticHigh = tip.congestionLevel === "high";
    const level =
      live.level === "high" || staticHigh
        ? "high"
        : live.level === "low"
          ? "low"
          : "mid";
    return { tip, live, level, weather: w };
  });

  const busy = scored
    .filter((s) => s.level === "high")
    .sort((a, b) => {
      const aCoast = COASTAL_HOT.has(a.tip.region) ? 1 : 0;
      const bCoast = COASTAL_HOT.has(b.tip.region) ? 1 : 0;
      return bCoast - aCoast;
    });
  const calm = scored
    .filter(
      (s) =>
        s.level === "low" &&
        (s.tip.quiet || quietSet.has(s.tip.region))
    )
    .slice(0, 3);

  if (!busy.length || !calm.length) {
    // 폴백: 정적 high/low
    const fbBusy = Object.values(tips).filter((t) => t.congestionLevel === "high");
    const fbCalm = Object.values(tips).filter(
      (t) => t.quiet && t.congestionLevel === "low"
    );
    if (!fbBusy.length || !fbCalm.length) return null;
    return {
      from: fbBusy[0],
      to: fbCalm.slice(0, 3),
      reason: "권역 혼잡 힌트",
      level: "high",
    };
  }

  const from = busy[0];
  const reasonParts = [
    ...(from.live.reasons.slice(0, 2) || []),
    from.weather ? `${from.weather.label} ${from.weather.temp ?? "–"}°` : "",
  ].filter(Boolean);

  return {
    from: from.tip,
    to: calm.map((c) => c.tip),
    reason: reasonParts.join(" · ") || "해안 혼잡 → 한산 분산",
    level: "high",
  };
}

/** 해안 혼잡 → 한산 분산 · 날씨 반영 실시간 CTA */
export function CongestionBanner({ tips }: { tips: Record<string, RegionTip> }) {
  const [weather, setWeather] = useState<WeatherCard[]>([]);
  const [now, setNow] = useState(() => clockLabel());
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      try {
        const cities = await fetchWeatherCached();
        if (!cancelled && Array.isArray(cities)) {
          setWeather(cities as WeatherCard[]);
          setLive(true);
          setNow(clockLabel());
        }
      } catch {
        /* 정적 힌트만 사용 */
      }
    }
    void load();
    const weatherTimer = window.setInterval(load, 10 * 60 * 1000);
    const clockTimer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setNow(clockLabel());
    }, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(weatherTimer);
      window.clearInterval(clockTimer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const pick = useMemo(() => {
    const map = new Map<string, WeatherCard>();
    for (const c of weather) {
      map.set(c.city, c);
      map.set(c.city.replace(/(시|군)$/, ""), c);
    }
    return pickLive(tips, map);
  }, [tips, weather]);

  if (!pick) return null;

  const toNames = pick.to.map((t) => t.short).join(" · ");
  const ask = `${pick.from.short}는 혼잡하니 ${toNames} 당일 자연 코스로`;

  return (
    <div
      className="cong-banner shrink-0 animate-[ui-fade-up_0.5s_var(--ease)_both]"
      role="status"
      aria-live="polite"
    >
      <div className="cong-banner-live">
        <span className="cong-banner-dot" aria-hidden />
        <span className="cong-banner-live-text">
          {live ? "실시간" : "분산"} · {now}
        </span>
      </div>

      <div className="cong-banner-main">
        <p className="cong-banner-route">
          <span className="cong-from">{pick.from.short}</span>
          <span className="cong-arrow" aria-hidden>
            →
          </span>
          <span className="cong-to">{toNames}</span>
        </p>
        <p className="cong-banner-reason">{pick.reason}</p>
      </div>

      <Link
        href={`/?ask=${encodeURIComponent(ask)}`}
        className="cong-banner-cta"
      >
        한산 코스
      </Link>
    </div>
  );
}
