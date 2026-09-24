"use client";

import { useEffect, useRef, useState } from "react";
import { getKakaoJsKey, loadKakaoMaps, resetKakaoMapsLoader } from "@/lib/kakaoMap";
import type { RoutePlan } from "@/lib/route";
import type { MapEndpoint, PlanStep } from "@/lib/tripTypes";
import "leaflet/dist/leaflet.css";

export type MapSearchPick = {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  region?: string;
};

type Props = {
  steps: PlanStep[];
  focusOrder?: number;
  route?: RoutePlan | null;
  className?: string;
  /** 서울·경기 등 임의 출발/도착 */
  origin?: MapEndpoint | null;
  destination?: MapEndpoint | null;
  /** 지도 검색 결과를 출발·경유·도착으로 지정 */
  onAssignPlace?: (place: MapSearchPick, role: "origin" | "waypoint" | "destination") => void;
};

type Engine = "kakao" | "leaflet";

function pinHtml(label: string, color: string, active = false) {
  const ring = active ? "box-shadow:0 0 0 3px rgba(22,72,102,.28),0 2px 8px rgba(22,40,48,.28);" : "box-shadow:0 2px 8px rgba(22,40,48,.28);";
  return `<div style="
    min-width:26px;height:26px;padding:0 7px;border-radius:999px;
    background:${color};color:#fff;font:800 11px/26px Pretendard,sans-serif;
    text-align:center;border:2px solid #fff;white-space:nowrap;${ring}
  ">${label}</div>`;
}

async function mountLeaflet(
  host: HTMLElement,
  pts: PlanStep[],
  focusOrder: number | undefined,
  route: RoutePlan | null | undefined,
  origin?: MapEndpoint | null,
  destination?: MapEndpoint | null
) {
  const L = await import("leaflet");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  host.innerHTML = "";
  const map = L.map(host, {
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: false,
  });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 16,
  }).addTo(map);

  const fallbackPts: [number, number][] = [];
  if (origin) fallbackPts.push([origin.lat, origin.lng]);
  pts.forEach((p) => fallbackPts.push([p.spot.lat, p.spot.lng]));
  if (destination) fallbackPts.push([destination.lat, destination.lng]);

  const pathLatLngs =
    route?.polyline && route.polyline.length > 1
      ? route.polyline.map((p) => [p.lat, p.lng] as [number, number])
      : fallbackPts;

  if (pathLatLngs.length > 1) {
    L.polyline(pathLatLngs, {
      color: "#2a6a94",
      weight: 5,
      opacity: 0.88,
      lineJoin: "round",
    }).addTo(map);
  }

  if (origin) {
    L.marker([origin.lat, origin.lng], {
      icon: L.divIcon({
        className: "trip-map-pin",
        html: pinHtml("출발", "#1a7a4c"),
        iconSize: [52, 26],
        iconAnchor: [26, 26],
      }),
    })
      .addTo(map)
      .bindPopup(`<strong>출발</strong><br/>${origin.name}`);
  }
  if (destination) {
    L.marker([destination.lat, destination.lng], {
      icon: L.divIcon({
        className: "trip-map-pin",
        html: pinHtml("도착", "#b45309"),
        iconSize: [52, 26],
        iconAnchor: [26, 26],
      }),
    })
      .addTo(map)
      .bindPopup(`<strong>도착</strong><br/>${destination.name}`);
  }

  pts.forEach((step) => {
    const icon = L.divIcon({
      className: "trip-map-pin",
      html: pinHtml(`경${step.order}`, step.order === focusOrder ? "#164866" : "#2a6a94", step.order === focusOrder),
      iconSize: [44, 26],
      iconAnchor: [22, 26],
    });
    L.marker([step.spot.lat, step.spot.lng], { icon })
      .addTo(map)
      .bindPopup(
        `<strong style="font-size:13px">${step.order}. ${step.spot.name}</strong><br/><span style="color:#5a666c;font-size:12px">${step.spot.region}</span>`
      );
  });

  if (pathLatLngs.length) {
    map.fitBounds(L.latLngBounds(pathLatLngs).pad(0.18));
  }
  window.setTimeout(() => map.invalidateSize(), 60);
  return map;
}

/**
 * https://apis.map.kakao.com/web/guide/
 * var container = document.getElementById('map');
 * var options = { center: new kakao.maps.LatLng(lat, lng), level: 3 };
 * var map = new kakao.maps.Map(container, options);
 */
function kakaoPin(
  maps: NonNullable<NonNullable<typeof window.kakao>["maps"]>,
  map: import("@/lib/kakaoMap").KakaoMap,
  lat: number,
  lng: number,
  label: string,
  color: string,
  title: string,
  active = false
) {
  const wrap = document.createElement("button");
  wrap.type = "button";
  wrap.title = title;
  wrap.setAttribute("aria-label", title);
  wrap.style.cssText =
    "border:0;padding:0;background:transparent;cursor:pointer;transform:translateY(4px);";
  wrap.innerHTML = pinHtml(label, color, active);
  const position = new maps.LatLng(lat, lng);
  const overlay = new maps.CustomOverlay({
    position,
    content: wrap,
    xAnchor: 0.5,
    yAnchor: 1,
    zIndex: active ? 4 : 3,
  });
  overlay.setMap(map);
  return overlay;
}

function paintKakaoMap(
  host: HTMLElement,
  maps: NonNullable<NonNullable<typeof window.kakao>["maps"]>,
  pts: PlanStep[],
  focusOrder: number | undefined,
  route: RoutePlan | null | undefined,
  origin?: MapEndpoint | null,
  destination?: MapEndpoint | null
) {
  const centerSpot = pts.find((p) => p.order === focusOrder) || pts[0];
  const center = origin
    ? new maps.LatLng(origin.lat, origin.lng)
    : centerSpot
      ? new maps.LatLng(centerSpot.spot.lat, centerSpot.spot.lng)
      : new maps.LatLng(37.5, 127.0);
  const map = new maps.Map(host, { center, level: 9 });
  map.relayout?.();

  if (origin) {
    kakaoPin(maps, map, origin.lat, origin.lng, "출발", "#1a7a4c", `출발 · ${origin.name}`);
  }
  if (destination) {
    kakaoPin(
      maps,
      map,
      destination.lat,
      destination.lng,
      "도착",
      "#b45309",
      `도착 · ${destination.name}`
    );
  }

  pts.forEach((step) => {
    kakaoPin(
      maps,
      map,
      step.spot.lat,
      step.spot.lng,
      `경${step.order}`,
      step.order === focusOrder ? "#164866" : "#2a6a94",
      `경유 ${step.order}. ${step.spot.name} · ${step.spot.region}`,
      step.order === focusOrder
    );
  });

  const fallback: Array<{ lat: number; lng: number }> = [];
  if (origin) fallback.push(origin);
  pts.forEach((p) => fallback.push({ lat: p.spot.lat, lng: p.spot.lng }));
  if (destination) fallback.push(destination);

  const pathPts =
    route?.polyline && route.polyline.length > 1 ? route.polyline : fallback;
  let line: import("@/lib/kakaoMap").KakaoPolyline | null = null;
  if (pathPts.length > 1) {
    const path = pathPts.map((p) => new maps.LatLng(p.lat, p.lng));
    line = new maps.Polyline({
      path,
      strokeWeight: 5,
      strokeColor: "#2a6a94",
      strokeOpacity: 0.9,
      strokeStyle: "solid",
      map,
    });
    const bounds = new maps.LatLngBounds();
    path.forEach((ll) => bounds.extend(ll));
    map.setBounds(bounds, 72);
  }

  window.setTimeout(() => map.relayout?.(), 100);
  return { map, line };
}

export function TripRouteMap({
  steps,
  focusOrder,
  route,
  className,
  origin,
  destination,
  onAssignPlace,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const kakaoRef = useRef<{
    map: import("@/lib/kakaoMap").KakaoMap;
    line: import("@/lib/kakaoMap").KakaoPolyline | null;
  } | null>(null);
  const leafletRef = useRef<import("leaflet").Map | null>(null);
  const [engine, setEngine] = useState<Engine>("leaflet");
  const [mapError, setMapError] = useState("");
  const [retryTick, setRetryTick] = useState(0);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MapSearchPick[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [picked, setPicked] = useState<MapSearchPick | null>(null);
  const [searchErr, setSearchErr] = useState("");
  const [painted, setPainted] = useState(0);
  const searchOverlay = useRef<import("@/lib/kakaoMap").KakaoCustomOverlay | null>(null);
  const leafletSearchRef = useRef<{ remove: () => void } | null>(null);

  const pts = steps.filter(
    (s) => Number.isFinite(s.spot.lat) && Number.isFinite(s.spot.lng)
  );
  const ptsKey = pts
    .map((p) => `${p.order}:${p.spot.name}:${p.spot.region}:${p.spot.lat},${p.spot.lng}`)
    .join("|");
  const endsKey = `${origin?.lat || ""}:${origin?.lng || ""}|${destination?.lat || ""}:${destination?.lng || ""}`;
  const routeKey = route
    ? `${route.provider}:${route.distance_m}:${route.polyline?.length || 0}`
    : "none";
  const hasKakaoKey = Boolean(getKakaoJsKey());
  const canDraw = pts.length > 0 || Boolean(origin && destination);

  useEffect(() => {
    let alive = true;
    const gen = retryTick;
    kakaoRef.current = null;
    leafletRef.current?.remove();
    leafletRef.current = null;
    setMapError("");

    (async () => {
      if (!hostRef.current || !canDraw) return;

      if (hasKakaoKey) {
        try {
          const kakao = await loadKakaoMaps();
          if (!alive || !hostRef.current || gen !== retryTick) return;
          leafletRef.current?.remove();
          leafletRef.current = null;
          hostRef.current.innerHTML = "";
          kakaoRef.current = paintKakaoMap(
            hostRef.current,
            kakao.maps!,
            pts,
            focusOrder,
            route,
            origin,
            destination
          );
          setEngine("kakao");
          setPainted((n) => n + 1);
          window.setTimeout(() => kakaoRef.current?.map.relayout?.(), 120);
          window.setTimeout(() => kakaoRef.current?.map.relayout?.(), 400);
          return;
        } catch (err) {
          if (!alive) return;
          setMapError(
            err instanceof Error
              ? err.message
              : "카카오맵을 불러오지 못했어요"
          );
        }
      }

      if (!alive || !hostRef.current || gen !== retryTick) return;
      try {
        leafletRef.current = await mountLeaflet(
          hostRef.current,
          pts,
          focusOrder,
          route,
          origin,
          destination
        );
        setEngine("leaflet");
        setPainted((n) => n + 1);
      } catch {
        if (alive) setMapError((prev) => prev || "지도를 표시할 수 없어요");
      }
    })();

    return () => {
      alive = false;
      leafletRef.current?.remove();
      leafletRef.current = null;
      kakaoRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ptsKey, routeKey, hasKakaoKey, endsKey, canDraw, retryTick, focusOrder]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => {
      kakaoRef.current?.map.relayout?.();
      leafletRef.current?.invalidateSize();
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, [engine, canDraw]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      setSearchErr("");
      return;
    }
    const ac = new AbortController();
    const t = window.setTimeout(async () => {
      setSearchBusy(true);
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(term)}`, {
          signal: ac.signal,
        });
        const data = await res.json();
        if (ac.signal.aborted) return;
        if (!res.ok) {
          setHits([]);
          setSearchErr(typeof data.error === "string" ? data.error : "장소 검색에 실패했어요");
          return;
        }
        setSearchErr("");
        setHits((data.places || []).slice(0, 6) as MapSearchPick[]);
      } catch {
        if (!ac.signal.aborted) {
          setHits([]);
          setSearchErr("장소 검색에 실패했어요");
        }
      } finally {
        if (!ac.signal.aborted) setSearchBusy(false);
      }
    }, 280);
    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    searchOverlay.current?.setMap(null);
    searchOverlay.current = null;
    leafletSearchRef.current?.remove();
    leafletSearchRef.current = null;
    if (!picked) return;

    if (engine === "kakao" && kakaoRef.current && window.kakao?.maps) {
      const maps = window.kakao.maps;
      const pos = new maps.LatLng(picked.lat, picked.lng);
      kakaoRef.current.map.setCenter(pos);
      kakaoRef.current.map.setLevel?.(5);
      searchOverlay.current = kakaoPin(
        maps,
        kakaoRef.current.map,
        picked.lat,
        picked.lng,
        "검색",
        "#5b3a8c",
        `검색 · ${picked.name}`
      );
      return;
    }

    if (engine === "leaflet" && leafletRef.current) {
      const map = leafletRef.current;
      const place = picked;
      void import("leaflet").then((L) => {
        if (leafletRef.current !== map) return;
        leafletSearchRef.current?.remove();
        leafletSearchRef.current = L.marker([place.lat, place.lng], {
          icon: L.divIcon({
            className: "trip-map-pin",
            html: pinHtml("검색", "#5b3a8c"),
            iconSize: [52, 26],
            iconAnchor: [26, 26],
          }),
        })
          .addTo(map)
          .bindPopup(`<strong>검색</strong><br/>${place.name}`);
        map.panTo([place.lat, place.lng], { animate: true });
      });
    }
  }, [picked, engine, painted]);

  function assign(role: "origin" | "waypoint" | "destination") {
    if (!picked || !onAssignPlace) return;
    onAssignPlace(picked, role);
    setPicked(null);
    setQuery("");
    setHits([]);
  }

  function showWholeRoute() {
    setPicked(null);
    setQuery("");
    setHits([]);
    const maps = window.kakao?.maps;
    const path: Array<{ lat: number; lng: number }> =
      route?.polyline && route.polyline.length > 1
        ? route.polyline
        : [
            ...(origin ? [origin] : []),
            ...pts.map((p) => ({ lat: p.spot.lat, lng: p.spot.lng })),
            ...(destination ? [destination] : []),
          ];
    if (path.length < 1) return;
    if (engine === "kakao" && kakaoRef.current && maps) {
      const bounds = new maps.LatLngBounds();
      path.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lng)));
      kakaoRef.current.map.setBounds(bounds, 72);
      return;
    }
    if (engine === "leaflet" && leafletRef.current) {
      void import("leaflet").then((L) => {
        leafletRef.current?.fitBounds(
          L.latLngBounds(path.map((p) => [p.lat, p.lng] as [number, number])).pad(0.18)
        );
      });
    }
  }

  return (
    <div
      className={
        className ||
        "overflow-hidden rounded-[var(--radius)] border border-[var(--outline)] bg-white"
      }
    >
      <form
        className="border-b border-[var(--outline)] bg-white px-3 py-2.5"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="block text-[0.68rem] font-bold text-sea-deep">
          지도에서 장소 찾기
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="명소, 주소, 역 이름"
            className="ui-field mt-1 !py-1.5 text-[0.78rem]"
            aria-label="지도 장소 검색"
          />
        </label>
        {searchErr ? <p className="mb-0 mt-1 text-[0.68rem] text-red-700">{searchErr}</p> : null}
        {(hits.length > 0 || searchBusy) && (
          <ul className="mt-1 max-h-40 overflow-auto rounded-[var(--radius-sm)] border border-[var(--outline)] bg-white">
            {searchBusy && !hits.length ? (
              <li className="px-2 py-1.5 text-[0.7rem] text-muted">찾는 중…</li>
            ) : null}
            {hits.map((h) => (
              <li key={`${h.name}-${h.lat}`}>
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left text-[0.75rem] hover:bg-sea-mist"
                  onClick={() => {
                    setPicked(h);
                    setHits([]);
                    setQuery(h.name);
                    setSearchErr("");
                  }}
                >
                  <strong>{h.name}</strong>
                  {h.address ? (
                    <span className="block truncate text-[0.65rem] text-muted">{h.address}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        {picked && onAssignPlace ? (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[0.68rem] font-semibold text-muted">{picked.name}</span>
            <button type="button" className="ui-btn ui-btn-ghost !min-h-7 !px-2 !text-[0.68rem]" onClick={() => assign("origin")}>
              출발
            </button>
            <button type="button" className="ui-btn ui-btn-ghost !min-h-7 !px-2 !text-[0.68rem]" onClick={() => assign("waypoint")}>
              경유
            </button>
            <button type="button" className="ui-btn ui-btn-primary !min-h-7 !px-2 !text-[0.68rem]" onClick={() => assign("destination")}>
              도착
            </button>
            <button type="button" className="ui-btn ui-btn-ghost !min-h-7 !px-2 !text-[0.68rem]" onClick={showWholeRoute}>
              전체 경로
            </button>
          </div>
        ) : null}
      </form>

      <div className="relative bg-[#dfe8e4]">
      <div
        id="map"
        ref={hostRef}
        className="map_area trip-leaflet w-full"
        style={{ width: "100%", height: "400px", minHeight: "400px" }}
      />

      {mapError && engine !== "kakao" ? (
        <div className="absolute inset-x-2 bottom-2 z-[600] rounded-[var(--radius-sm)] border border-[var(--outline)] bg-white/95 px-3 py-2 text-[0.72rem] text-muted shadow-sm">
          <p className="m-0 leading-snug">{mapError}</p>
          <p className="mt-1 mb-0 text-[0.65rem]">
            카카오 개발자 콘솔 → 앱 설정 → 플랫폼 → Web → 사이트 도메인에{" "}
            <code className="text-sea">http://localhost:3000</code> 등록
          </p>
          <button
            type="button"
            className="mt-1.5 text-[0.7rem] font-semibold text-sea"
            onClick={() => {
              resetKakaoMapsLoader();
              setRetryTick((n) => n + 1);
            }}
          >
            다시 불러오기
          </button>
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-2 top-2 z-[500] flex max-w-[calc(100%-1rem)] flex-col gap-1">
        <p className="m-0 w-fit rounded-[var(--radius-sm)] bg-white/95 px-2.5 py-1 text-[0.68rem] font-bold text-sea-deep shadow-sm">
          {engine === "kakao" ? "카카오맵" : "경로 지도"}
          {route
            ? ` · ${
                route.provider === "kakao"
                  ? "카카오 내비"
                  : route.provider === "osrm"
                    ? "도로 경로"
                    : "직선 추정"
              } · ${route.duration_label} · ${route.distance_label}`
            : ""}
        </p>
        <p className="m-0 w-fit rounded-[var(--radius-sm)] bg-white/95 px-2 py-1 text-[0.65rem] font-semibold text-mountain-deep shadow-sm">
          <span className="text-[#1a7a4c]">출발</span>
          {pts.length ? ` → 경유 ${pts.map((p) => p.order).join("·")}` : ""}
          <span className="text-[#b45309]"> → 도착</span>
        </p>
      </div>
      </div>
    </div>
  );
}
