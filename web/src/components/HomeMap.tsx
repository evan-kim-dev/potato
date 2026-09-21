"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { BRIDGE_REGIONS, QUIET_REGIONS } from "@/lib/prefs";
import type { RegionTip } from "@/lib/data";
import { loadGangwonHeroSvg } from "@/lib/gangwonSvg";

const COASTAL = new Set([
  "강릉시",
  "고성군",
  "동해시",
  "삼척시",
  "속초시",
  "양양군",
]);

const QUIET = new Set<string>(QUIET_REGIONS);
const BRIDGE = new Set<string>(BRIDGE_REGIONS);

export const REGION_DRAFT_EVENT = "gw:region-draft";

function fallbackTip(region: string): RegionTip {
  return {
    region,
    short: region.replace(/(시|군)$/, ""),
    headline: "강원의 매력 있는 여행지",
    tagline: "강원도의 매력 있는 여행지",
    pop: "—",
    specialty: "지역 먹거리·자연",
    highlight: "AI 맞춤 코스 추천",
    quiet: QUIET.has(region),
    officialUrl: "https://www.gangwon.to/gwtour",
    themes: [],
    spots: [],
    spotCount: 0,
    beaches: [],
    dispersion: [],
  };
}

function placementOverflow(
  x: number,
  y: number,
  tipW: number,
  tipH: number,
  maxW: number,
  maxH: number,
  pad: number
) {
  return (
    Math.max(0, pad - x) +
    Math.max(0, pad - y) +
    Math.max(0, x + tipW - (maxW - pad)) +
    Math.max(0, y + tipH - (maxH - pad))
  );
}

export function HomeMap({
  tips,
  compact = false,
}: {
  tips: Record<string, RegionTip>;
  compact?: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const pinnedRef = useRef(false);
  const [error, setError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [hint, setHint] = useState("시·군을 눌러 정보를 보세요");
  const [active, setActive] = useState<RegionTip | null>(null);
  const [pinned, setPinned] = useState(false);
  const [placement, setPlacement] = useState("above");

  useEffect(() => {
    pinnedRef.current = pinned;
  }, [pinned]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const svgText = await loadGangwonHeroSvg();
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = svgText;
        const svg = hostRef.current.querySelector("svg");
        svg?.classList.add("h-auto", "w-full");
        svg?.setAttribute("preserveAspectRatio", "xMidYMid meet");
        ensureEastSea(hostRef.current);
        hostRef.current.querySelectorAll(".gw-surface path[data-region]").forEach((path) => {
          const region = path.getAttribute("data-region") || "";
          path.classList.add("gw-district");
          if (COASTAL.has(region)) path.classList.add("gw-coast");
          if (QUIET.has(region)) path.classList.add("gw-quiet");
          else if (BRIDGE.has(region)) path.classList.add("gw-bridge");
          path.setAttribute("tabindex", "0");
          path.setAttribute("role", "button");
          path.setAttribute("aria-label", region);
        });
        setMapReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "지도 로드 실패");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !hostRef.current) return;
    hostRef.current.querySelectorAll(".gw-surface path[data-region]").forEach((el) => {
      const path = el as SVGPathElement;
      const region = path.getAttribute("data-region") || "";
      path.classList.remove("gw-busy", "gw-mid", "gw-calm");
      const tip = tips[region];
      const lvl = tip?.congestionLevel;
      if (lvl === "high") path.classList.add("gw-busy");
      else if (lvl === "mid") path.classList.add("gw-mid");
      else if (lvl === "low") path.classList.add("gw-calm");
      const cong = tip?.congestionLabel ? ` · ${tip.congestionLabel}` : "";
      path.setAttribute("aria-label", `${region}${cong}`);
    });
  }, [mapReady, tips]);

  useEffect(() => {
    function onDoc(e: Event) {
      if (!pinnedRef.current) return;
      const t = e.target as Element | null;
      if (!t) return;
      if (t.closest?.("path[data-region]")) return;
      if (t.closest?.(".landing-region-tip")) return;
      hideTip(true);
    }
    function onResize() {
      if (pathRef.current && tipRef.current && active) {
        positionTip(pathRef.current, tipRef.current);
      }
    }
    document.addEventListener("click", onDoc);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("click", onDoc);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active || !pathRef.current || !tipRef.current) return;
    const id = requestAnimationFrame(() => {
      if (pathRef.current && tipRef.current) {
        positionTip(pathRef.current, tipRef.current);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [active, pinned]);

  function clearFocus() {
    hostRef.current?.classList.remove("has-district-hover");
    hostRef.current?.querySelectorAll("path.on").forEach((el) => el.classList.remove("on"));
  }

  function hideTip(force = false) {
    if (pinnedRef.current && !force) return;
    setActive(null);
    setPinned(false);
    pinnedRef.current = false;
    pathRef.current = null;
    clearFocus();
    setHint("시·군을 눌러 정보를 보세요");
  }

  function positionTip(path: SVGPathElement, tip: HTMLDivElement) {
    const stage = stageRef.current;
    const svg = path.ownerSVGElement;
    if (!stage || !svg) return;

    const bb = path.getBBox();
    const pt = svg.createSVGPoint();
    pt.x = bb.x + bb.width / 2;
    pt.y = bb.y + bb.height / 2;
    const ctm = path.getCTM();
    if (!ctm) return;

    const abs = pt.matrixTransform(ctm);
    const svgRect = svg.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const w = vb.width || 960;
    const h = vb.height || 820;

    const anchorX = svgRect.left - stageRect.left + (abs.x / w) * svgRect.width;
    const anchorY = svgRect.top - stageRect.top + (abs.y / h) * svgRect.height;

    tip.style.visibility = "hidden";
    tip.style.left = "0px";
    tip.style.top = "0px";
    const tipW = tip.offsetWidth;
    const tipH = tip.offsetHeight;
    tip.style.visibility = "";

    const pad = 12;
    const gap = 12;
    const maxW = stageRect.width;
    const maxH = stageRect.height;

    const candidates = [
      { placement: "above", x: anchorX - tipW / 2, y: anchorY - tipH - gap },
      { placement: "below", x: anchorX - tipW / 2, y: anchorY + gap },
      { placement: "above-left", x: anchorX - tipW - gap, y: anchorY - tipH - gap },
      { placement: "above-right", x: anchorX + gap, y: anchorY - tipH - gap },
      { placement: "below-left", x: anchorX - tipW - gap, y: anchorY + gap },
      { placement: "below-right", x: anchorX + gap, y: anchorY + gap },
      { placement: "right", x: anchorX + gap, y: anchorY - tipH / 2 },
      { placement: "left", x: anchorX - tipW - gap, y: anchorY - tipH / 2 },
    ];

    let best = candidates[0];
    let bestScore = Infinity;
    for (const c of candidates) {
      const score = placementOverflow(c.x, c.y, tipW, tipH, maxW, maxH, pad);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }

    const x = Math.min(Math.max(best.x, pad), Math.max(pad, maxW - tipW - pad));
    const y = Math.min(Math.max(best.y, pad), Math.max(pad, maxH - tipH - pad));
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
    setPlacement(best.placement);
  }

  function showTip(path: SVGPathElement, nextPinned: boolean) {
    const region = path.getAttribute("data-region") || "";
    if (!region) return;
    const tip = tips[region] || fallbackTip(region);

    hostRef.current?.classList.add("has-district-hover");
    hostRef.current?.querySelectorAll(".gw-district").forEach((p) => {
      p.classList.toggle("on", p === path);
    });

    pathRef.current = path;
    pinnedRef.current = nextPinned;
    setPinned(nextPinned);
    setActive(tip);
    setHint(
      nextPinned
        ? tip.quiet
          ? `${tip.short} · 한산 권역`
          : `${tip.short} · 인근 한산으로 분산`
        : "다시 누르면 고정됩니다"
    );
  }

  function draftAsk(tip: RegionTip) {
    const draft = tip.quiet
      ? `${tip.short} 한산한 숨은 명소 당일 코스`
      : tip.dispersion.length
        ? `${tip.short} 대신 인근 한산 권역(${tip.dispersion
            .map((d) => d.replace(/\(.*\)$/, ""))
            .slice(0, 2)
            .join("·")}) 숨은 명소 당일 코스`
        : `${tip.short}에서 가까운 한산·인구감소 권역 숨은 명소 코스`;
    window.dispatchEvent(
      new CustomEvent(REGION_DRAFT_EVENT, {
        detail: { region: tip.region, short: tip.short, draft, autoSend: true },
      })
    );
  }

  function onHostClick(e: MouseEvent) {
    const path = (e.target as Element).closest?.(
      "path[data-region]"
    ) as SVGPathElement | null;
    if (!path) return;
    e.stopPropagation();
    showTip(path, true);
  }

  function onHostMouseOver(e: MouseEvent) {
    if (pinnedRef.current) return;
    const path = (e.target as Element).closest?.(
      "path[data-region]"
    ) as SVGPathElement | null;
    if (!path) return;
    showTip(path, false);
  }

  function onHostMouseOut(e: MouseEvent) {
    if (pinnedRef.current) return;
    const related = e.relatedTarget as Element | null;
    if (related?.closest?.("path[data-region]")) return;
    if (related?.closest?.(".landing-region-tip")) return;
    hideTip(false);
  }

  function onHostKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      hideTip(true);
      return;
    }
    if (e.key !== "Enter" && e.key !== " ") return;
    const path = (e.target as Element).closest?.(
      "path[data-region]"
    ) as SVGPathElement | null;
    if (!path) return;
    e.preventDefault();
    showTip(path, true);
  }

  return (
    <div
      ref={stageRef}
      className={`landing-map-stage relative w-full animate-[ui-fade-up_0.4s_var(--ease)_both]${
        compact
          ? " landing-map-stage--compact max-w-none"
          : " max-w-[640px] lg:max-w-none"
      }`}
      role="group"
      aria-label="강원도 지도 — 시·군 선택"
      onClick={onHostClick}
      onMouseOver={onHostMouseOver}
      onMouseOut={onHostMouseOut}
      onKeyDown={onHostKey}
    >
      <div
        ref={hostRef}
        className={`landing-map-art home-map-art relative w-full select-none [&_svg]:pointer-events-auto${
          compact
            ? " [&_svg]:h-auto [&_svg]:w-auto [&_svg]:max-h-full [&_svg]:max-w-full"
            : " [&_svg]:h-auto [&_svg]:w-full"
        }`}
        aria-busy={!mapReady}
      />
      {!mapReady && !error && (
        <div
          className="pointer-events-none absolute inset-0 animate-pulse rounded-[var(--radius)] bg-gradient-to-br from-sea-mist/70 to-mountain-soft/50"
          aria-hidden
        />
      )}
      <div
        ref={tipRef}
        className={`landing-region-tip${active ? "" : " hidden"}${pinned ? " is-pinned" : ""}`}
        data-placement={placement}
        aria-live="polite"
        role={pinned ? "dialog" : undefined}
        aria-label={active ? `${active.region} 정보` : undefined}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          /* keep hover tip while moving into panel */
        }}
        onMouseLeave={() => {
          if (!pinnedRef.current) hideTip(false);
        }}
      >
        {active && (
          <>
            {active.photo?.image ? (
              <div className="landing-region-tip-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active.photo.image}
                  alt={active.photo.title || active.region}
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget.parentElement as HTMLElement | null)?.remove();
                  }}
                />
                {active.photo.title ? (
                  <span className="landing-region-tip-photo-cap">
                    {active.photo.title}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="landing-region-tip-head">
              <strong>{active.short || active.region}</strong>
              {active.quiet ? (
                <span className="landing-region-tip-wx">한산</span>
              ) : BRIDGE.has(active.region) ? (
                <span className="landing-region-tip-wx">연계</span>
              ) : COASTAL.has(active.region) ? (
                <span className="landing-region-tip-wx">해안</span>
              ) : (
                <span className="landing-region-tip-wx">기타</span>
              )}
              {active.congestionLabel ? (
                <span
                  className={
                    active.congestionLevel === "high"
                      ? "landing-region-tip-wx is-busy"
                      : active.congestionLevel === "low"
                        ? "landing-region-tip-wx is-calm"
                        : "landing-region-tip-wx"
                  }
                >
                  {active.congestionLabel}
                  {active.congestionProxy ? "·추정" : ""}
                </span>
              ) : null}
            </div>
            <p className="landing-region-tip-blurb">
              {active.headline || active.tagline}
            </p>
            <div className="landing-region-tip-meta">
              <span>{active.pop}</span>
              <span>{active.specialty}</span>
            </div>
            {(active.spots.length > 0 || active.dispersion.length > 0) && (
              <p className="landing-region-tip-spots">
                {active.spots.length
                  ? active.spots.slice(0, 3).join(" · ")
                  : active.dispersion.slice(0, 3).join(" · ")}
              </p>
            )}
            {active.festival ? (
              <p className="landing-region-tip-fest">{active.festival.title}</p>
            ) : null}
            <div className="landing-region-tip-actions">
              <button
                type="button"
                className="landing-region-tip-ask"
                data-region={active.region}
                onClick={() => draftAsk(active)}
              >
                {active.quiet ? "코스 물어보기" : "한산으로 분산"}
              </button>
              <a
                href={active.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="landing-region-tip-close"
                onClick={(e) => e.stopPropagation()}
              >
                관광
              </a>
              <button
                type="button"
                className="landing-region-tip-close"
                onClick={() => hideTip(true)}
              >
                닫기
              </button>
            </div>
          </>
        )}
      </div>
      <div className="landing-map-legend" aria-label="지도 범례">
        <div className="landing-map-legend-row">
          <span className="landing-map-legend-item">
            <i className="landing-map-swatch is-quiet" aria-hidden />
            인구감소·한산
          </span>
          <span className="landing-map-legend-item">
            <i className="landing-map-swatch is-busy" aria-hidden />
            혼잡 우려
          </span>
          <span className="landing-map-legend-item">
            <i className="landing-map-swatch is-coast" aria-hidden />
            해안
          </span>
          <span className="landing-map-legend-item">
            <i className="landing-map-swatch is-bridge" aria-hidden />
            연계
          </span>
        </div>
        {!compact ? (
          <p className="landing-map-legend-note">
            한산 권역: 영월·정선·태백·양구·인제·화천·철원·고성
          </p>
        ) : null}
        <p className="landing-map-legend-hint">{hint}</p>
      </div>
      {error && (
        <p className="mt-1 text-center text-xs text-red-700 lg:text-left">{error}</p>
      )}
    </div>
  );
}

function ensureEastSea(root: HTMLElement) {
  const svg = root.querySelector("svg");
  if (!svg || svg.querySelector("#east-sea")) return;

  const vb = (svg.getAttribute("viewBox") || "0 0 800 900").split(/\s+/).map(Number);
  const [, , w = 800, h = 900] = vb;
  const seaWidth = Math.max(28, Math.round(w * 0.042));
  const sea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  sea.setAttribute("id", "east-sea");
  sea.setAttribute("x", String(w - seaWidth));
  sea.setAttribute("y", "0");
  sea.setAttribute("width", String(seaWidth));
  sea.setAttribute("height", String(h));
  sea.setAttribute("fill", "url(#eastSeaGrad)");
  sea.setAttribute("pointer-events", "none");
  sea.setAttribute("aria-hidden", "true");

  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.insertBefore(defs, svg.firstChild);
  }
  if (!defs.querySelector("#eastSeaGrad")) {
    const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    grad.setAttribute("id", "eastSeaGrad");
    grad.setAttribute("x1", "0");
    grad.setAttribute("y1", "0");
    grad.setAttribute("x2", "1");
    grad.setAttribute("y2", "0");
    const s0 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s0.setAttribute("offset", "0%");
    s0.setAttribute("stop-color", "#9ec9e8");
    s0.setAttribute("stop-opacity", "0.55");
    const s1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s1.setAttribute("offset", "100%");
    s1.setAttribute("stop-color", "#6ba8d4");
    s1.setAttribute("stop-opacity", "0.85");
    grad.append(s0, s1);
    defs.appendChild(grad);
  }

  const surface = svg.querySelector(".gw-surface");
  if (surface?.parentNode) {
    surface.parentNode.insertBefore(sea, surface);
  } else {
    svg.appendChild(sea);
  }
}
