export type RoutePoint = {
  name: string;
  lat: number;
  lng: number;
  region?: string;
};

export type RouteLeg = {
  from: string;
  to: string;
  distance_m: number;
  duration_s: number;
  distance_label: string;
  duration_label: string;
};

export type RoutePlan = {
  provider: "kakao" | "osrm" | "straight";
  distance_m: number;
  duration_s: number;
  distance_label: string;
  duration_label: string;
  legs: RouteLeg[];
  polyline: Array<{ lat: number; lng: number }>;
};

function labelDistance(m: number) {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)}km`;
}

function labelDuration(s: number) {
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `약 ${min}분`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `약 ${h}시간 ${r}분` : `약 ${h}시간`;
}

function haversineM(a: RoutePoint, b: RoutePoint) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function straightRoute(points: RoutePoint[]): RoutePlan {
  const legs: RouteLeg[] = [];
  const polyline: Array<{ lat: number; lng: number }> = [];
  let distance_m = 0;
  let duration_s = 0;
  for (let i = 0; i < points.length; i++) {
    polyline.push({ lat: points[i].lat, lng: points[i].lng });
    if (i === 0) continue;
    const d = haversineM(points[i - 1], points[i]);
    // 산지 도로 보정: 직선×1.35, 평균 42km/h
    const road = d * 1.35;
    const t = (road / 42000) * 3600;
    distance_m += road;
    duration_s += t;
    legs.push({
      from: points[i - 1].name,
      to: points[i].name,
      distance_m: road,
      duration_s: t,
      distance_label: labelDistance(road),
      duration_label: labelDuration(t),
    });
  }
  return {
    provider: "straight",
    distance_m,
    duration_s,
    distance_label: labelDistance(distance_m),
    duration_label: labelDuration(duration_s),
    legs,
    polyline,
  };
}

export type OsrmProfile = "driving" | "foot" | "bike";

export async function fetchOsrmRoute(
  points: RoutePoint[],
  profile: OsrmProfile = "driving"
): Promise<RoutePlan | null> {
  if (points.length < 2) return null;
  const path = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/${profile}/${path}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) return null;
  const coords = (route.geometry?.coordinates || []) as number[][];
  const polyline = coords.map(([lng, lat]) => ({ lat, lng }));
  const legs: RouteLeg[] = (route.legs || []).map(
    (leg: { distance: number; duration: number }, i: number) => ({
      from: points[i]?.name || `P${i + 1}`,
      to: points[i + 1]?.name || `P${i + 2}`,
      distance_m: leg.distance,
      duration_s: leg.duration,
      distance_label: labelDistance(leg.distance),
      duration_label: labelDuration(leg.duration),
    })
  );
  return {
    provider: "osrm",
    distance_m: route.distance,
    duration_s: route.duration,
    distance_label: labelDistance(route.distance),
    duration_label: labelDuration(route.duration),
    legs,
    polyline,
  };
}

export function parseKakaoDirections(
  points: RoutePoint[],
  kakaoData: Record<string, unknown>
): RoutePlan | null {
  const routes = kakaoData.routes as Array<Record<string, unknown>> | undefined;
  const route = routes?.[0];
  if (!route) return null;
  // 0만 성공. 103 등은 "주변 도로 탐색 실패" 등 — 폴백해야 함
  const resultCode = Number(route.result_code ?? NaN);
  if (Number.isFinite(resultCode) && resultCode !== 0) return null;

  const summary = (route.summary || {}) as Record<string, unknown>;
  const sections = (route.sections || []) as Array<Record<string, unknown>>;
  const legs: RouteLeg[] = [];
  const polyline: Array<{ lat: number; lng: number }> = [];

  sections.forEach((sec, i) => {
    const roads = (sec.roads || []) as Array<Record<string, unknown>>;
    for (const road of roads) {
      const v = road.vertexes as number[] | undefined;
      if (!v) continue;
      for (let k = 0; k + 1 < v.length; k += 2) {
        polyline.push({ lng: v[k], lat: v[k + 1] });
      }
    }
    const d = Number(sec.distance || 0);
    const t = Number(sec.duration || 0);
    legs.push({
      from: points[i]?.name || `P${i + 1}`,
      to: points[i + 1]?.name || `P${i + 2}`,
      distance_m: d,
      duration_s: t,
      distance_label: labelDistance(d),
      duration_label: labelDuration(t),
    });
  });

  const distance_m = Number(
    summary.distance ?? legs.reduce((a, l) => a + l.distance_m, 0)
  );
  const duration_s = Number(
    summary.duration ?? legs.reduce((a, l) => a + l.duration_s, 0)
  );
  if (!Number.isFinite(distance_m) || distance_m <= 0) return null;
  if (!polyline.length) {
    points.forEach((p) => polyline.push({ lat: p.lat, lng: p.lng }));
  }

  return {
    provider: "kakao",
    distance_m,
    duration_s,
    distance_label: labelDistance(distance_m),
    duration_label: labelDuration(duration_s),
    legs,
    polyline,
  };
}
