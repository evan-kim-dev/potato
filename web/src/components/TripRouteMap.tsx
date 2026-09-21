"use client";

import { useEffect, useRef, useState } from "react";
import { getKakaoJsKey, loadKakaoMaps } from "@/lib/kakaoMap";
import type { RoutePlan } from "@/lib/route";
import type { MapEndpoint, PlanStep } from "@/lib/tripTypes";
import "leaflet/dist/leaflet.css";

type Props = {
  steps: PlanStep[];
  focusOrder?: number;
  route?: RoutePlan | null;
  className?: string;
  /** 서울·경기 등 임의 출발/도착 */
  origin?: MapEndpoint | null;
  destination?: MapEndpoint | null;
};

type Engine = "kakao" | "leaflet";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function divIconHtml(order: number, active: boolean) {
  const bg = active ? "#164866" : "#2a6a94";
  return `<div style="
    width:28px;height:28px;border-radius:50%;
    background:${bg};color:#fff;font:800 12px/28px Pretendard,sans-serif;
    text-align:center;border:2.5px solid #fff;
    box-shadow:0 2px 8px rgba(22,40,48,.28);
  ">${order}</div>`;
}

function endIconHtml(label: string, color: string) {
  return `<div style="
    padding:2px 7px;border-radius:999px;background:${color};color:#fff;
    font:700 11px/1.4 Pretendard,sans-serif;border:2px solid #fff;
    box-shadow:0 2px 8px rgba(22,40,48,.28);white-space:nowrap;
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
        html: endIconHtml("출발", "#1a7a4c"),
        iconSize: [48, 22],
        iconAnchor: [24, 11],
      }),
    })
      .addTo(map)
      .bindPopup(`<strong>출발</strong><br/>${origin.name}`);
  }
  if (destination) {
    L.marker([destination.lat, destination.lng], {
      icon: L.divIcon({
        className: "trip-map-pin",
        html: endIconHtml("도착", "#b45309"),
        iconSize: [48, 22],
        iconAnchor: [24, 11],
      }),
    })
      .addTo(map)
      .bindPopup(`<strong>도착</strong><br/>${destination.name}`);
  }

  pts.forEach((step) => {
    const icon = L.divIcon({
      className: "trip-map-pin",
      html: divIconHtml(step.order, step.order === focusOrder),
      iconSize: [28, 28],
      iconAnchor: [14, 14],
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
function paintKakaoMap(
  host: HTMLElement,
  maps: NonNullable<typeof window.kakao>["maps"],
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

  const markEnd = (end: MapEndpoint, label: string) => {
    const marker = new maps.Marker({
      position: new maps.LatLng(end.lat, end.lng),
      map,
      title: `${label} ${end.name}`,
    });
    const iw = new maps.InfoWindow({
      content: `<div style="padding:8px 12px;font-size:12px;font-weight:700;">${label}<br/><span style="font-weight:500">${escapeHtml(end.name)}</span></div>`,
    });
    maps.event.addListener(marker, "click", () => iw.open(map, marker));
  };
  if (origin) markEnd(origin, "출발");
  if (destination) markEnd(destination, "도착");

  pts.forEach((step) => {
    const marker = new maps.Marker({
      position: new maps.LatLng(step.spot.lat, step.spot.lng),
      map,
      title: `${step.order}. ${step.spot.name}`,
    });
    const iw = new maps.InfoWindow({
      content: `<div style="padding:8px 12px;font-size:12px;line-height:1.45;font-weight:700;min-width:120px;">${step.order}. ${escapeHtml(step.spot.name)}<br/><span style="font-weight:500;color:#5a6b64">${escapeHtml(step.spot.region)}</span></div>`,
    });
    maps.event.addListener(marker, "click", () => iw.open(map, marker));
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
    map.setBounds(bounds, 56);
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
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const kakaoRef = useRef<{
    map: import("@/lib/kakaoMap").KakaoMap;
    line: import("@/lib/kakaoMap").KakaoPolyline | null;
  } | null>(null);
  const leafletRef = useRef<import("leaflet").Map | null>(null);
  const [engine, setEngine] = useState<Engine>("leaflet");

  const pts = steps.filter(
    (s) => Number.isFinite(s.spot.lat) && Number.isFinite(s.spot.lng)
  );
  const ptsKey = pts.map((p) => `${p.order}:${p.spot.lat},${p.spot.lng}`).join("|");
  const endsKey = `${origin?.lat || ""}:${origin?.lng || ""}|${destination?.lat || ""}:${destination?.lng || ""}`;
  const routeKey = route
    ? `${route.provider}:${route.distance_m}:${route.polyline?.length || 0}`
    : "none";
  const hasKakaoKey = Boolean(getKakaoJsKey());
  const canDraw = pts.length > 0 || Boolean(origin && destination);

  useEffect(() => {
    let cancelled = false;
    kakaoRef.current = null;
    leafletRef.current?.remove();
    leafletRef.current = null;

    (async () => {
      if (!hostRef.current || !canDraw) return;

      if (hasKakaoKey) {
        try {
          const kakao = await loadKakaoMaps();
          if (cancelled || !hostRef.current) return;
          leafletRef.current?.remove();
          leafletRef.current = null;
          hostRef.current.innerHTML = "";
          kakaoRef.current = paintKakaoMap(
            hostRef.current,
            kakao.maps,
            pts,
            focusOrder,
            route,
            origin,
            destination
          );
          setEngine("kakao");
          return;
        } catch {
          /* leaflet fallback */
        }
      }

      if (cancelled || !hostRef.current) return;
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
      } catch {
        /* keep empty */
      }
    })();

    return () => {
      cancelled = true;
      leafletRef.current?.remove();
      leafletRef.current = null;
      kakaoRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ptsKey, routeKey, hasKakaoKey, endsKey, canDraw]);

  useEffect(() => {
    if (!pts.length) return;
    const focus = pts.find((p) => p.order === focusOrder) || pts[0];
    if (engine === "kakao" && kakaoRef.current && window.kakao?.maps) {
      kakaoRef.current.map.setCenter(
        new window.kakao.maps.LatLng(focus.spot.lat, focus.spot.lng)
      );
    }
    if (engine === "leaflet" && leafletRef.current) {
      leafletRef.current.panTo([focus.spot.lat, focus.spot.lng], { animate: true });
    }
  }, [focusOrder, pts, engine]);

  return (
    <div
      className={
        className ||
        "relative overflow-hidden rounded-[var(--radius)] border border-[var(--outline)] bg-[#dfe8e4]"
      }
    >
      <div
        id="map"
        ref={hostRef}
        className="map_area trip-leaflet w-full"
        style={{ width: "100%", height: "400px", minHeight: "400px" }}
      />

      {route && (
        <p className="pointer-events-none absolute left-2 top-2 z-[500] rounded-[var(--radius-sm)] bg-white/95 px-2.5 py-1 text-[0.7rem] font-bold text-sea-deep shadow-sm">
          {engine === "kakao" ? "카카오맵" : "경로 지도"}
          {" · "}
          {route.provider === "kakao"
            ? "카카오 내비"
            : route.provider === "osrm"
              ? "도로 경로"
              : "직선 추정"}{" "}
          · {route.duration_label} · {route.distance_label}
        </p>
      )}
    </div>
  );
}
