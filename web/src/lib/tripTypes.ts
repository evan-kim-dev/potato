export type PlanSpot = {
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
};

export type PlanStep = {
  order: number;
  day: number;
  stay: number;
  why: string;
  move_to_next?: string;
  kind?: "origin" | "destination" | "stop";
  spot: PlanSpot;
};

export type TripPlan = {
  id: string;
  query: string;
  savedAt: string;
  title: string;
  summary: string;
  duration: string;
  source: string;
  steps: PlanStep[];
  stopNames: string[];
  /** 채팅·플래너에서 지정한 출발/도착 (경로 계산용) */
  origin?: MapEndpoint | null;
  destination?: MapEndpoint | null;
  mode?: TravelMode;
  /** 저밀도·ESG 분산 점수 (선택) */
  dispersion?: {
    score: number;
    grade: "A" | "B" | "C" | "D";
    label: string;
    quietRatio: number;
    quietStops: number;
    totalStops: number;
    adjacentLegs: number;
    totalLegs: number;
    coastalHotStops: number;
    esgNote: string;
  };
};

/** 카카오맵 URL 이동수단 — https://apis.map.kakao.com/web/guide/ */
export type TravelMode = "car" | "walk" | "bicycle" | "traffic";

export const TRAVEL_MODES: { id: Exclude<TravelMode, "traffic">; label: string }[] = [
  { id: "car", label: "자동차" },
  { id: "walk", label: "도보" },
  { id: "bicycle", label: "자전거" },
];

export type MapEndpoint = {
  name: string;
  lat: number;
  lng: number;
};

/** 채팅·플래너가 API plan에 출발/도착/모드를 붙일 때 공용 */
export function withTripEndpoints(
  plan: TripPlan,
  opts: {
    origin?: MapEndpoint | null;
    destination?: MapEndpoint | null;
    mode?: TravelMode;
  }
): TripPlan {
  return {
    ...plan,
    mode: opts.mode ?? plan.mode,
    origin: opts.origin ?? plan.origin,
    destination: opts.destination ?? plan.destination,
  };
}

export function kakaoMapLink(
  steps: PlanStep[],
  opts?: {
    from?: MapEndpoint | null;
    to?: MapEndpoint | null;
    mode?: TravelMode;
  }
) {
  const pts = steps.filter((s) => Number.isFinite(s.spot.lat) && Number.isFinite(s.spot.lng));
  const from =
    opts?.from ||
    (pts[0]
      ? { name: pts[0].spot.name, lat: pts[0].spot.lat, lng: pts[0].spot.lng }
      : null);
  const to =
    opts?.to ||
    (pts.length
      ? {
          name: pts[pts.length - 1].spot.name,
          lat: pts[pts.length - 1].spot.lat,
          lng: pts[pts.length - 1].spot.lng,
        }
      : null);
  if (!from && !to) return "https://map.kakao.com/";
  if (from && !to) {
    return `https://map.kakao.com/link/map/${encodeURIComponent(from.name)},${from.lat},${from.lng}`;
  }
  if (!from || !to) return "https://map.kakao.com/";
  const mode = opts?.mode || "car";
  const a = `${encodeURIComponent(from.name)},${from.lat},${from.lng}`;
  const b = `${encodeURIComponent(to.name)},${to.lat},${to.lng}`;
  return `https://map.kakao.com/link/by/${mode}/${a}/${b}`;
}

export function spotMapUrl(spot: PlanSpot) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(spot.name)},${spot.lat},${spot.lng}`;
}
