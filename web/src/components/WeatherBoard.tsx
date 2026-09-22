"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BeachCard } from "@/lib/beachWeather";
import type { WeatherCard } from "@/lib/weather";
import { Button, PageHeader, Panel } from "@/components/ui";
import { QUIET_REGIONS } from "@/lib/prefs";
import { loadGangwonHeroSvg } from "@/lib/gangwonSvg";
import { fetchWeatherCached } from "@/lib/weatherClientCache";

const QUIET_SET = new Set<string>(QUIET_REGIONS);
const COASTAL = new Set(["강릉시", "고성군", "동해시", "삼척시", "속초시", "양양군"]);

function regionKey(name: string) {
  return String(name || "").replace(/(시|군)$/, "");
}

function tempBand(temp: number | null | undefined) {
  if (temp == null || !Number.isFinite(temp)) return "unknown";
  if (temp <= 0) return "t0";
  if (temp <= 8) return "t1";
  if (temp <= 15) return "t2";
  if (temp <= 22) return "t3";
  if (temp <= 28) return "t4";
  return "t5";
}

type Focus =
  | { kind: "city"; key: string }
  | { kind: "beach"; id: number }
  | null;

export function WeatherBoard({
  initial,
  beaches: initialBeaches,
}: {
  initial: WeatherCard[];
  beaches: BeachCard[];
}) {
  const [cards, setCards] = useState(initial);
  const [beaches, setBeaches] = useState(initialBeaches);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [focus, setFocus] = useState<Focus>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  const byKey = useMemo(() => {
    const map = new Map<string, WeatherCard>();
    cards.forEach((c) => map.set(regionKey(c.city), c));
    return map;
  }, [cards]);

  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => {
      const aQuiet = [...QUIET_SET].some((r) => regionKey(r) === regionKey(a.city)) ? 0 : 1;
      const bQuiet = [...QUIET_SET].some((r) => regionKey(r) === regionKey(b.city)) ? 0 : 1;
      if (aQuiet !== bQuiet) return aQuiet - bQuiet;
      return a.city.localeCompare(b.city, "ko");
    });
  }, [cards]);

  const focusedCity =
    focus?.kind === "city" ? byKey.get(regionKey(focus.key)) || null : null;
  const focusedBeach =
    focus?.kind === "beach"
      ? beaches.find((b) => b.beach_num === focus.id) || null
      : null;

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const [cities, beachRes] = await Promise.all([
        fetchWeatherCached({ force: true }),
        fetch("/api/beaches"),
      ]);
      if (!cities) throw new Error("날씨 실패");
      setCards(cities as WeatherCard[]);
      const beachData = await beachRes.json();
      if (beachRes.ok) setBeaches(beachData.beaches || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "날씨 갱신 실패");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void refresh();
    };
    const id = window.setInterval(tick, 10 * 60 * 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const svgText = await loadGangwonHeroSvg();
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = svgText;
        const svg = hostRef.current.querySelector("svg");
        svg?.classList.add("weather-hero-svg");
        svg?.setAttribute("aria-hidden", "true");
        hostRef.current.querySelectorAll(".gw-surface path[data-region]").forEach((el) => {
          const path = el as SVGPathElement;
          const region = path.getAttribute("data-region") || "";
          path.classList.add("gw-district", "wx-district");
          if (QUIET_SET.has(region)) path.classList.add("gw-quiet");
          else if (COASTAL.has(region)) path.classList.add("gw-coast");
          path.setAttribute("role", "button");
          path.setAttribute("tabindex", "0");
        });
        setMapReady(true);
      } catch (e) {
        if (!cancelled) setMapError(e instanceof Error ? e.message : "지도 로드 실패");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 시·군 기온 + 바다(해변) 마커
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !mapReady) return;

    const focusKey = focus?.kind === "city" ? focus.key : "";
    paintDistricts(host, byKey, focusKey);

    const labelLayer = host.querySelector(".gw-labels");
    if (labelLayer) {
      labelLayer.classList.add("wx-baked-labels");
      labelLayer.querySelectorAll("text").forEach((node) => {
        const text = node as SVGTextElement;
        const short =
          text.getAttribute("data-region-short") ||
          (text.textContent || "").replace(/\s*\d+°$/, "").trim();
        if (!short) return;
        text.setAttribute("data-region-short", short);
        const wx = byKey.get(short);
        const active =
          focus?.kind === "city" && regionKey(focus.key) === regionKey(short);
        text.classList.toggle("is-on", active);
        const x = text.getAttribute("x") || "0";
        while (text.firstChild) text.removeChild(text.firstChild);
        const name = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        name.setAttribute("x", x);
        name.setAttribute("dy", "0");
        name.textContent = short;
        text.appendChild(name);
        const temp = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        temp.setAttribute("x", x);
        temp.setAttribute("dy", "1.2em");
        temp.setAttribute("class", "wx-temp");
        temp.textContent = wx?.temp == null ? "—" : `${wx.temp}°`;
        text.appendChild(temp);
      });
    }

    host.querySelectorAll(".wx-beaches").forEach((n) => n.remove());
    const svg = host.querySelector("svg");
    if (svg && beaches.length) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "wx-beaches");
      beaches.forEach((b) => {
        if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return;
        const { x, y } = latLngToSvg(b.lat, b.lng);
        const on = focus?.kind === "beach" && focus.id === b.beach_num;
        const mark = document.createElementNS("http://www.w3.org/2000/svg", "g");
        mark.setAttribute("class", on ? "wx-beach on" : "wx-beach");
        mark.setAttribute("data-beach", String(b.beach_num));
        mark.setAttribute("role", "button");
        mark.setAttribute("tabindex", "0");
        mark.setAttribute(
          "aria-label",
          `${b.name} ${b.liveTemp == null ? "" : `${b.liveTemp}도`}`
        );
        mark.style.cursor = "pointer";

        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", String(x));
        dot.setAttribute("cy", String(y));
        dot.setAttribute("r", on ? "7" : "5.5");
        dot.setAttribute("class", "wx-beach-dot");
        mark.appendChild(dot);

        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", String(x + 9));
        label.setAttribute("y", String(y + 4));
        label.setAttribute("class", "wx-beach-label");
        label.textContent =
          b.liveTemp == null ? b.name : `${b.name} ${b.liveTemp}°`;
        mark.appendChild(label);

        g.appendChild(mark);
      });
      svg.appendChild(g);
    }
  }, [byKey, beaches, focus, mapReady]);

  function onStageClick(e: React.MouseEvent | React.KeyboardEvent) {
    const t = e.target as Element | null;
    const beach = t?.closest?.(".wx-beach") as SVGGElement | null;
    if (beach) {
      const id = Number(beach.getAttribute("data-beach"));
      if (Number.isFinite(id)) setFocus({ kind: "beach", id });
      return;
    }
    const label = t?.closest?.(".gw-labels text") as SVGTextElement | null;
    if (label) {
      const short =
        label.getAttribute("data-region-short") ||
        (label.textContent || "").replace(/\s*\d+°$/, "").trim();
      if (short) setFocus({ kind: "city", key: regionKey(short) });
      return;
    }
    const path = t?.closest?.(".wx-district") as SVGPathElement | null;
    if (!path) return;
    const region = path.getAttribute("data-region") || "";
    if (region) setFocus({ kind: "city", key: regionKey(region) });
  }

  return (
    <div>
      <PageHeader
        title="지역 날씨"
        sub="시·군 기온과 동해안 바다(해변) 기온을 함께 봅니다"
        action={
          <Button variant="secondary" onClick={() => void refresh()} disabled={busy}>
            {busy ? "갱신 중…" : "새로고침"}
          </Button>
        }
      />

      {error && (
        <p className="mb-3 rounded-[var(--radius)] bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.55fr)]">
        <div
          className="relative overflow-visible rounded-[var(--radius)] border border-[var(--outline)] bg-[linear-gradient(165deg,#dfe8e4_0%,#d5e4ef_100%)]"
          onClick={onStageClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onStageClick(e);
          }}
        >
          <div
            ref={hostRef}
            className="weather-map-art mx-auto aspect-[960/820] w-full max-h-[min(70vh,640px)] overflow-visible [&_svg]:h-full [&_svg]:w-full [&_svg]:overflow-visible"
          />
          <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--outline)] bg-white/92 px-2.5 py-1 text-[0.7rem] text-muted">
              <span>낮음</span>
              <span className="h-1.5 w-14 rounded bg-[linear-gradient(90deg,#b7c9d4,#cfe8df,#e8dcc4)]" />
              <span>높음</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--outline)] bg-white/92 px-2.5 py-1 text-[0.7rem] text-muted">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2a6a94]" />
              바다(해변)
            </div>
          </div>
          {mapError && (
            <p className="absolute bottom-3 right-3 rounded-[var(--radius-sm)] bg-white/90 px-2 py-1 text-xs text-red-700">
              {mapError}
            </p>
          )}
        </div>

        <aside className="flex flex-col gap-3">
          <Panel className="p-4">
            {focusedBeach ? (
              <>
                <p className="m-0 text-[0.68rem] font-semibold text-sea">바다 · 해변</p>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <div>
                    <h2 className="m-0 text-lg font-bold tracking-tight">
                      {focusedBeach.full_name || focusedBeach.name}
                    </h2>
                    <p className="mt-0.5 text-sm text-muted">
                      {focusedBeach.region}
                      {focusedBeach.coast ? ` · ${focusedBeach.coast}` : ""}
                      {" · "}
                      {focusedBeach.liveLabel}
                    </p>
                  </div>
                  <strong className="text-3xl font-bold tracking-tight text-sea">
                    {focusedBeach.liveTemp == null ? "—" : `${focusedBeach.liveTemp}°`}
                  </strong>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.75rem] text-muted">
                  {focusedBeach.weather?.wave_m != null && (
                    <span>파고 {focusedBeach.weather.wave_m}m</span>
                  )}
                  {focusedBeach.weather?.wind_ms != null && (
                    <span>바람 {focusedBeach.weather.wind_ms}m/s</span>
                  )}
                  {focusedBeach.weather?.pop != null && (
                    <span>강수 {focusedBeach.weather.pop}%</span>
                  )}
                </div>
                <p className="mt-2 text-[0.8rem] text-muted">
                  {focusedBeach.tip || "해안 혼잡 시 인근 한산 권역으로 분산해 보세요."}
                </p>
                <a
                  href={`/?ask=${encodeURIComponent(
                    `${focusedBeach.region || "동해안"} 해안 대신 인근 한산·인구감소 권역 저밀도 코스`
                  )}`}
                  className="ui-btn ui-btn-primary mt-3"
                >
                  한산 권역으로 분산
                </a>
              </>
            ) : focusedCity ? (
              <>
                <p className="m-0 text-[0.68rem] font-semibold text-mountain">시·군 날씨</p>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <div>
                    <h2 className="m-0 text-lg font-bold tracking-tight">{focusedCity.city}</h2>
                    <p className="mt-0.5 text-sm text-muted">{focusedCity.label}</p>
                  </div>
                  <strong className="text-3xl font-bold tracking-tight text-sea">
                    {focusedCity.temp == null ? "—" : `${focusedCity.temp}°`}
                  </strong>
                </div>
                {focusedCity.range && (
                  <p className="mt-2 text-[0.8rem] font-semibold text-mountain-deep">
                    오늘 {focusedCity.range}
                  </p>
                )}
                <p className="mt-1 text-[0.8rem] text-muted">{focusedCity.tip}</p>
                <a
                  href={`/?ask=${encodeURIComponent(
                    [...QUIET_SET].some((r) => regionKey(r) === regionKey(focusedCity.city))
                      ? `${focusedCity.city} 한산한 숨은 명소 날씨 맞는 당일 코스`
                      : `${focusedCity.city}에서 가까운 한산·인구감소 권역 저밀도 코스`
                  )}`}
                  className="ui-btn ui-btn-primary mt-3"
                >
                  AI 한산 코스
                </a>
              </>
            ) : (
              <p className="m-0 text-sm text-muted">
                지도를 누르면 시·군 기온이, 파란 점은 바다(해변) 기온이 열립니다.
              </p>
            )}
          </Panel>

          <div className="ui-panel max-h-[200px] space-y-0.5 overflow-y-auto p-1.5">
            <p className="px-2 py-1 text-[0.65rem] font-semibold text-muted">시·군 (한산 우선)</p>
            {sortedCards.map((c) => {
              const active =
                focus?.kind === "city" && regionKey(c.city) === regionKey(focus.key);
              return (
                <button
                  key={c.city}
                  type="button"
                  onClick={() => setFocus({ kind: "city", key: regionKey(c.city) })}
                  className={
                    active
                      ? "flex w-full items-center gap-2 rounded-[var(--radius-sm)] bg-sea-mist px-2.5 py-2 text-left"
                      : "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left hover:bg-sea-mist/70"
                  }
                >
                  <span className="min-w-0 flex-1 truncate text-[0.8rem] font-semibold">
                    {c.city}
                  </span>
                  <strong className="text-[0.95rem] font-bold text-sea">
                    {c.temp == null ? "—" : `${c.temp}°`}
                  </strong>
                </button>
              );
            })}
          </div>

          <div className="ui-panel max-h-[220px] space-y-0.5 overflow-y-auto p-1.5">
            <p className="px-2 py-1 text-[0.65rem] font-semibold text-muted">바다 (해변)</p>
            {beaches.map((b) => {
              const active = focus?.kind === "beach" && focus.id === b.beach_num;
              return (
                <button
                  key={b.beach_num}
                  type="button"
                  onClick={() => setFocus({ kind: "beach", id: b.beach_num })}
                  className={
                    active
                      ? "flex w-full items-center gap-2 rounded-[var(--radius-sm)] bg-sea-mist px-2.5 py-2 text-left"
                      : "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left hover:bg-sea-mist/70"
                  }
                >
                  <span className="min-w-0 flex-1 truncate text-[0.8rem] font-semibold">
                    {b.name}
                    <span className="ml-1 font-medium text-muted">{b.region}</span>
                  </span>
                  <strong className="text-[0.95rem] font-bold text-sea">
                    {b.liveTemp == null ? "—" : `${b.liveTemp}°`}
                  </strong>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

function paintDistricts(host: HTMLElement, byKey: Map<string, WeatherCard>, focusKey: string) {
  host.querySelectorAll(".gw-surface path[data-region]").forEach((el) => {
    const path = el as SVGPathElement;
    const region = path.getAttribute("data-region") || "";
    const key = regionKey(region);
    const wx = byKey.get(key);
    path.classList.remove("wx-t0", "wx-t1", "wx-t2", "wx-t3", "wx-t4", "wx-t5", "wx-unknown", "on");
    path.classList.add(`wx-${tempBand(wx?.temp)}`);
    if (focusKey && key === regionKey(focusKey)) path.classList.add("on");
    path.setAttribute("aria-label", wx ? `${region} ${wx.temp}도 ${wx.label}` : region);
  });
  if (focusKey) host.classList.add("has-district-hover");
  else host.classList.remove("has-district-hover");
}

/** gangwon-hero.svg viewBox(960×820)용 대략 투영 — 동해안 해변 배치 */
function latLngToSvg(lat: number, lng: number) {
  const x = ((lng - 126.95) / (129.45 - 126.95)) * 920 + 20;
  const y = ((38.62 - lat) / (38.62 - 37.05)) * 780 + 20;
  return {
    x: Math.min(940, Math.max(20, x)),
    y: Math.min(800, Math.max(20, y)),
  };
}
