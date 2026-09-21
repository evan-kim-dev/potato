"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QUIET_REGIONS } from "@/lib/prefs";
import { loadGangwonHeroSvg } from "@/lib/gangwonSvg";
import type { PassportStamp } from "@/lib/passport";

type Props = {
  stamps: PassportStamp[];
};

function hashRot(region: string) {
  let h = 0;
  for (let i = 0; i < region.length; i++) h = (h * 31 + region.charCodeAt(i)) | 0;
  return (Math.abs(h) % 17) - 8;
}

function formatStampDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd}`;
}

function nsEl<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string> = {}
) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** 강원 지도와 같은 좌표계에 여권 도장을 심음 */
export function PassportStampMap({ stamps }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<SVGGElement | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  const stampByRegion = useMemo(
    () => new Map(stamps.map((s) => [s.region, s])),
    [stamps]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const svgText = await loadGangwonHeroSvg();
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = svgText;
        const svg = hostRef.current.querySelector("svg");
        if (!svg) return;

        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", "한산 여권 스탬프 지도");
        svg.classList.add("passport-map-svg");

        // 라벨은 도장과 겹치지 않게 살짝 숨김
        svg.querySelector(".gw-labels")?.classList.add("passport-labels-dim");

        const surface = svg.querySelector(".gw-surface");
        const parent =
          (surface?.parentNode as SVGGElement | null) ||
          (svg as unknown as SVGGElement);

        const layer = nsEl("g", {
          class: "passport-stamp-layer-g",
          "aria-hidden": "false",
        });
        parent.appendChild(layer);
        layerRef.current = layer;

        svg.querySelectorAll(".gw-surface path[data-region]").forEach((el) => {
          const path = el as SVGPathElement;
          const region = path.getAttribute("data-region") || "";
          path.classList.add("gw-district");
          const quiet = (QUIET_REGIONS as readonly string[]).includes(region);
          path.classList.toggle("passport-quiet", quiet);
          path.classList.toggle("passport-other", !quiet);
          if (!quiet) return;

          const box = path.getBBox();
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          const short = region.replace(/(시|군)$/, "");
          const rot = hashRot(region);

          const g = nsEl("g", {
            class: "passport-seal is-ghost",
            "data-region": region,
            transform: `translate(${x} ${y}) rotate(${rot})`,
            tabindex: "0",
            role: "button",
            "aria-label": `${short} 도장`,
          });

          // 작은 원형 도장 — 시·군 안에 들어가도록 반지름 축소
          const r = Math.min(28, Math.max(16, Math.min(box.width, box.height) * 0.28));
          g.appendChild(nsEl("circle", { class: "passport-seal-ring", r: String(r) }));
          g.appendChild(
            nsEl("circle", {
              class: "passport-seal-ring-inner",
              r: String(r * 0.78),
            })
          );

          const brand = nsEl("text", {
            class: "passport-seal-brand",
            y: String(-r * 0.28),
          });
          brand.textContent = "ON道";
          g.appendChild(brand);

          const name = nsEl("text", {
            class: "passport-seal-name",
            y: String(r * 0.18),
          });
          name.textContent = short;
          g.appendChild(name);

          const meta = nsEl("text", {
            class: "passport-seal-meta",
            y: String(r * 0.52),
          });
          meta.textContent = "한산";
          g.appendChild(meta);

          g.addEventListener("mouseenter", () => setActive(region));
          g.addEventListener("mouseleave", () => setActive(null));
          g.addEventListener("focus", () => setActive(region));
          g.addEventListener("blur", () => setActive(null));
          g.addEventListener("click", () => setActive(region));

          layer.appendChild(g);
        });

        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setReady(false);
      }
    })();
    return () => {
      cancelled = true;
      layerRef.current = null;
    };
  }, []);

  // 스탬프 상태만 갱신 (좌표는 SVG 안에 고정)
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !ready) return;

    host.querySelectorAll(".gw-surface path[data-region]").forEach((el) => {
      const path = el as SVGPathElement;
      const region = path.getAttribute("data-region") || "";
      path.classList.toggle("passport-stamped", stampByRegion.has(region));
    });

    host.querySelectorAll(".passport-seal[data-region]").forEach((el) => {
      const g = el as SVGGElement;
      const region = g.getAttribute("data-region") || "";
      const stamp = stampByRegion.get(region);
      const collected = Boolean(stamp);
      g.classList.toggle("is-ink", collected);
      g.classList.toggle("is-ghost", !collected);

      const meta = g.querySelector(".passport-seal-meta");
      if (meta) {
        meta.textContent = collected
          ? formatStampDate(stamp?.lastAt) || `${stamp?.count}회`
          : "한산";
      }
      const short = region.replace(/(시|군)$/, "");
      g.setAttribute(
        "aria-label",
        collected ? `${short} 도장 ${stamp?.count || 1}회` : `${short} 미방문`
      );
    });
  }, [stampByRegion, ready]);

  const collected = stamps.length;
  const tip = (() => {
    if (!active) {
      return "한산 시·군 위에 도장이 맞춰져 있어요. 도장을 누르면 기록이 보여요.";
    }
    const s = stampByRegion.get(active);
    const short = active.replace(/(시|군)$/, "");
    if (!s) {
      return `${short} · 미방문 — 일정 찜 또는 강원페이 영수증으로 도장을 찍어요.`;
    }
    return `${short} · ${s.count}회 · 최근 ${formatStampDate(s.lastAt) || "기록됨"}`;
  })();

  return (
    <section className="passport-map-card" aria-label="한산 여권 도장 지도">
      <div className="passport-map-head">
        <div>
          <h2 className="m-0 text-[0.9rem] font-bold text-mountain-deep">
            여권 도장 지도
          </h2>
          <p className="mt-0.5 m-0 text-[0.72rem] text-muted">
            방문한 한산 시·군에만 잉크 도장이 찍힙니다
          </p>
        </div>
        <div className="passport-map-legend" aria-hidden>
          <span className="passport-leg is-ink">방문</span>
          <span className="passport-leg is-ghost">미방문</span>
          <span className="tabular-nums font-semibold text-sea">
            {collected}/{QUIET_REGIONS.length}
          </span>
        </div>
      </div>

      <div className="passport-map-stage">
        <div
          ref={hostRef}
          className={`passport-map-art${ready ? " is-ready" : ""}`}
        />
        {!ready ? (
          <div className="passport-map-skel" aria-hidden>
            지도 불러오는 중…
          </div>
        ) : null}
      </div>

      <p className={`passport-map-tip${active ? "" : " is-idle"}`}>{tip}</p>
    </section>
  );
}
