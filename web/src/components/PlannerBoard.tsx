"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  getCurrentTrip,
  loadAuth,
  loginLocal,
  saveTripForUser,
  setCurrentTrip,
  type AuthSession,
} from "@/lib/storage";
import {
  kakaoMapLink,
  spotMapUrl,
  TRAVEL_MODES,
  withTripEndpoints,
  type PlanSpot,
  type PlanStep,
  type TravelMode,
  type TripPlan,
} from "@/lib/tripTypes";
import { benefitsForRegions, isQuietRegion } from "@/lib/benefits";
import { LocalBenefits } from "@/components/LocalBenefits";
import { MerchantNearStop } from "@/components/MerchantNearStop";
import { DispersionScoreBar } from "@/components/DispersionScoreBar";
import { scoreTripDispersion } from "@/lib/impactScore";
import { stampQuietRegionsFromTrip } from "@/lib/passport";
import {
  PlaceSearchField,
  type PlacePick,
} from "@/components/PlaceSearchField";
import type { RoutePlan } from "@/lib/route";
import dynamic from "next/dynamic";

const TripMap = dynamic(
  () => import("@/components/TripRouteMap").then((m) => m.TripRouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center rounded-[var(--radius)] border border-[var(--outline)] bg-white/80 text-sm text-muted lg:h-[420px]">
        지도 연결 중…
      </div>
    ),
  }
);

const MODES = TRAVEL_MODES;
const STAYS = ["당일", "1박", "2박"] as const;
const PURPOSES = ["자연", "바다", "드라이브", "문화", "한산"] as const;

function readStay(duration?: string): (typeof STAYS)[number] {
  if (/2\s*박/.test(duration || "")) return "2박";
  if (/1\s*박/.test(duration || "")) return "1박";
  return "당일";
}

function stayLabel(stay: (typeof STAYS)[number]) {
  if (stay === "1박") return "1박 2일";
  if (stay === "2박") return "2박 3일";
  return "당일";
}

function renumber(steps: PlanStep[]): PlanStep[] {
  return steps.map((s, i) => ({ ...s, order: i + 1 }));
}

function withTrip(
  trip: TripPlan,
  steps: PlanStep[],
  ends?: { origin?: PlacePick | null; destination?: PlacePick | null }
): TripPlan {
  const next: TripPlan = {
    ...trip,
    steps: renumber(steps),
    stopNames: steps.map((s) => s.spot.name),
    savedAt: new Date().toISOString(),
  };
  if (ends) {
    next.origin = ends.origin
      ? { name: ends.origin.name, lat: ends.origin.lat, lng: ends.origin.lng }
      : ends.origin === null
        ? null
        : trip.origin;
    next.destination = ends.destination
      ? {
          name: ends.destination.name,
          lat: ends.destination.lat,
          lng: ends.destination.lng,
        }
      : ends.destination === null
        ? null
        : trip.destination;
  }
  setCurrentTrip(next);
  return next;
}

export function PlannerBoard(props: { seed?: TripPlan | null } = {}) {
  const seed = props.seed ?? null;
  const [trip, setTrip] = useState<TripPlan | null>(seed ?? null);
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [focus, setFocus] = useState(seed?.steps?.[0]?.order || 1);
  const [day, setDay] = useState(0);
  const [savedMsg, setSavedMsg] = useState("");
  const [nickDraft, setNickDraft] = useState("");
  const [saveError, setSaveError] = useState("");
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeAt, setRouteAt] = useState<string | null>(null);
  const [origin, setOrigin] = useState<PlacePick | null>(null);
  const [destination, setDestination] = useState<PlacePick | null>(null);
  const [mode, setMode] = useState<TravelMode>("car");
  const [stay, setStay] = useState<(typeof STAYS)[number]>("당일");
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]>("자연");
  const [regen, setRegen] = useState("");
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenErr, setRegenErr] = useState("");
  const [routeErr, setRouteErr] = useState("");
  const [addQ, setAddQ] = useState("");
  const [addHits, setAddHits] = useState<PlanSpot[]>([]);
  const [wx, setWx] = useState<Record<string, { temp: number; label?: string }>>({});
  const [routeNote, setRouteNote] = useState("");
  const corridorSig = useRef("");
  const tripRef = useRef(trip);
  tripRef.current = trip;

  function persistEnds(nextOrigin: PlacePick | null, nextDest: PlacePick | null) {
    setOrigin(nextOrigin);
    setDestination(nextDest);
    setTrip((prev) => {
      if (!prev) return prev;
      return withTrip(prev, prev.steps, {
        origin: nextOrigin,
        destination: nextDest,
      });
    });
  }

  useEffect(() => {
    setAuth(loadAuth());
    const current = getCurrentTrip();
    if (current?.steps?.length) {
      setTrip(current);
      setFocus(current.steps[0].order);
      if (current.origin?.lat != null) {
        setOrigin({
          name: current.origin.name,
          lat: current.origin.lat,
          lng: current.origin.lng,
        });
      }
      if (current.destination?.lat != null) {
        setDestination({
          name: current.destination.name,
          lat: current.destination.lat,
          lng: current.destination.lng,
        });
      }
      if (
        current.mode === "car" ||
        current.mode === "walk" ||
        current.mode === "bicycle"
      ) {
        setMode(current.mode);
      }
      setStay(readStay(current.duration));
      return;
    }
    if (seed?.steps?.length) {
      setCurrentTrip(seed);
      setTrip(seed);
      setFocus(seed.steps[0].order);
      if (seed.origin?.lat != null) {
        setOrigin({
          name: seed.origin.name,
          lat: seed.origin.lat,
          lng: seed.origin.lng,
        });
      }
      if (seed.destination?.lat != null) {
        setDestination({
          name: seed.destination.name,
          lat: seed.destination.lat,
          lng: seed.destination.lng,
        });
      }
      if (
        seed.mode === "car" ||
        seed.mode === "walk" ||
        seed.mode === "bicycle"
      ) {
        setMode(seed.mode);
      }
    }
  }, [seed]);

  const days = useMemo(() => {
    if (!trip) return [];
    return [...new Set(trip.steps.map((s) => s.day))].sort((a, b) => a - b);
  }, [trip]);

  const visible = useMemo(() => {
    if (!trip) return [] as PlanStep[];
    if (!day) return trip.steps;
    return trip.steps.filter((s) => s.day === day);
  }, [trip, day]);
  const routeSteps = trip?.steps?.length ? trip.steps : visible;

  const active = trip?.steps.find((s) => s.order === focus) || visible[0];
  const benefit = trip
    ? benefitsForRegions(trip.steps.map((s) => s.spot.region))
    : null;
  const quietCount = trip
    ? trip.steps.filter((s) => isQuietRegion(s.spot.region)).length
    : 0;
  const dispersion = trip ? scoreTripDispersion(trip.steps) : null;

  // 실시간 경로 — 경유 2곳+ 또는 출발·도착 지정 시
  useEffect(() => {
    const canRoute =
      routeSteps.length >= 2 ||
      (Boolean(origin) && Boolean(destination)) ||
      (Boolean(origin) && routeSteps.length >= 1) ||
      (Boolean(destination) && routeSteps.length >= 1);
    if (!canRoute) {
      setRoute(null);
      setRouteErr("");
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      setRouteBusy(true);
      setRouteErr("");
      try {
        const res = await fetch("/api/directions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            mode,
            origin: origin || undefined,
            destination: destination || undefined,
            points: routeSteps.map((s) => ({
              name: s.spot.name,
              lat: s.spot.lat,
              lng: s.spot.lng,
              region: s.spot.region,
            })),
          }),
        });
        const data = await res.json();
        if (ac.signal.aborted) return;
        if (res.ok) {
          setRoute(data as RoutePlan);
          setRouteAt(
            new Date().toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          );
        } else {
          setRoute(null);
          setRouteErr(String(data?.error || "경로를 불러오지 못했어요"));
        }
      } catch {
        if (!ac.signal.aborted) {
          setRoute(null);
          setRouteErr("경로 요청이 실패했어요");
        }
      } finally {
        if (!ac.signal.aborted) setRouteBusy(false);
      }
    }, 200);
    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [routeSteps, mode, origin, destination]);

  // 실시간 날씨 (코스 권역)
  useEffect(() => {
    if (!trip?.steps.length) return;
    const regions = [...new Set(trip.steps.map((s) => s.spot.region))];
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/weather", { signal: ac.signal });
        const data = await res.json();
        if (!res.ok || ac.signal.aborted) return;
        const map: Record<string, { temp: number; label?: string }> = {};
        for (const c of data.cities || []) {
          if (c.temp == null || !c.city) continue;
          const cShort = String(c.city).replace(/(시|군)$/, "");
          for (const r of regions) {
            const short = r.replace(/(시|군)$/, "");
            if (r === c.city || short === cShort) {
              map[r] = { temp: c.temp, label: c.label };
            }
          }
        }
        setWx(map);
      } catch {
        /* ignore */
      }
    })();
    return () => ac.abort();
  }, [trip]);

  // 스팟 검색 (추가)
  useEffect(() => {
    const q = addQ.trim();
    if (q.length < 1) {
      setAddHits([]);
      return;
    }
    const ac = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/spots?q=${encodeURIComponent(q)}&limit=8`, {
          signal: ac.signal,
        });
        const data = await res.json();
        if (!ac.signal.aborted) setAddHits(data.spots || []);
      } catch {
        if (!ac.signal.aborted) setAddHits([]);
      }
    }, 220);
    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [addQ]);

  const updateSteps = useCallback((nextSteps: PlanStep[], keepFocus?: number) => {
    setTrip((prev) => {
      if (!prev) return prev;
      const next = withTrip(prev, nextSteps, {
        origin,
        destination,
      });
      const still =
        keepFocus != null && next.steps.some((s) => s.order === keepFocus)
          ? keepFocus
          : next.steps.find((s) => s.order === focus)?.order || next.steps[0]?.order || 1;
      setFocus(still);
      return next;
    });
  }, [origin, destination, focus]);

  useEffect(() => {
    if (!origin || !destination || !trip?.steps?.length || regenBusy) return;
    const sig = `live7|${mode}|${stay}|${purpose}|${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}|${destination.lat.toFixed(3)},${destination.lng.toFixed(3)}`;
    if (corridorSig.current === sig) return;
    const ac = new AbortController();
    const ends = { origin, destination };
    setRouteNote("경로 위 장소를 실시간으로 찾는 중…");
    (async () => {
      try {
        const res = await fetch("/api/route-stops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            mode,
            duration: stay,
            text: purpose,
            origin: { name: ends.origin.name, lat: ends.origin.lat, lng: ends.origin.lng },
            destination: {
              name: ends.destination.name,
              lat: ends.destination.lat,
              lng: ends.destination.lng,
            },
          }),
        });
        const data = await res.json();
        if (ac.signal.aborted || !res.ok) return;
        if (!data.steps?.length) {
          corridorSig.current = sig;
          setRouteNote("이 출발·도착 경로 위에 넣을 만한 명소가 없어요. 경유는 그대로 둡니다.");
          return;
        }
        corridorSig.current = sig;
        const nextSteps = data.steps as PlanStep[];
        const names = nextSteps.map((s) => s.spot.name);
        const prev = tripRef.current;
        if (!prev) return;
        const same =
          prev.steps.length === nextSteps.length &&
          prev.steps.every((s, i) => {
            const n = nextSteps[i]?.spot;
            return (
              s.spot.name === n?.name &&
              s.spot.region === n?.region &&
              s.spot.lat === n?.lat
            );
          });
        if (same) {
          setRouteNote(
            `${ends.origin.name} → ${ends.destination.name} 가는 길 경유를 유지해요 · ${names.join(" · ")}`
          );
          return;
        }
        setTrip(
          withTrip(
            {
              ...prev,
              title: String(data.title || prev.title),
              summary: String(data.summary || prev.summary),
              dispersion: data.dispersion || scoreTripDispersion(data.steps),
            },
            data.steps as PlanStep[],
            { origin: ends.origin, destination: ends.destination }
          )
        );
        setFocus(1);
        const summary = String(data.summary || "");
        setRouteNote(
          summary.includes("다녀오는")
            ? summary
            : `${ends.origin.name} → ${ends.destination.name} 가는 길 경유 · ${names.join(" · ")}`
        );
      } catch {
        if (!ac.signal.aborted) setRouteNote("");
      }
    })();
    return () => ac.abort();
  }, [origin, destination, mode, stay, purpose, trip?.steps?.length, regenBusy]);

  function moveStep(order: number, dir: -1 | 1) {
    if (!trip) return;
    const idx = trip.steps.findIndex((s) => s.order === order);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= trip.steps.length) return;
    const copy = [...trip.steps];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    const renumbered = renumber(copy);
    updateSteps(renumbered, renumbered[j]?.order);
  }

  function removeStep(order: number) {
    if (!trip || trip.steps.length <= 2) return;
    updateSteps(
      trip.steps.filter((s) => s.order !== order),
      focus === order ? undefined : focus
    );
  }

  function addSpot(spot: PlanSpot) {
    if (!trip) return;
    if (trip.steps.some((s) => s.spot.name === spot.name)) return;
    const dayMax = Math.max(...trip.steps.map((s) => s.day), 1);
    updateSteps([
      ...trip.steps,
      {
        order: trip.steps.length + 1,
        day: dayMax,
        stay: 70,
        why: `${spot.region} · ${spot.theme}`,
        spot,
      },
    ]);
    setAddQ("");
    setAddHits([]);
  }

  async function regenerate() {
    const prompt = regen.trim();
    if (prompt.length < 2 || regenBusy) return;
    setRegenBusy(true);
    setRegenErr("");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          prefs: "한산·숨은, 저밀도 동선",
          prefsStructured: {
            themes: ["quiet", "nature"],
            companion: "",
            budget: "",
          },
          originName: origin?.name || "",
          destinationName: destination?.name || "",
          originLat: origin?.lat,
          originLng: origin?.lng,
          destinationLat: destination?.lat,
          destinationLng: destination?.lng,
          slots: {
            origin: origin?.name,
            destination: destination?.name,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegenErr(String(data?.error || `생성 실패 (${res.status})`));
        return;
      }
      if (data.plan?.steps?.length) {
        const plan = withTripEndpoints(data.plan as TripPlan, {
          origin: origin
            ? { name: origin.name, lat: origin.lat, lng: origin.lng }
            : null,
          destination: destination
            ? {
                name: destination.name,
                lat: destination.lat,
                lng: destination.lng,
              }
            : null,
          mode,
        });
        setCurrentTrip(plan);
        setTrip(plan);
        setFocus(plan.steps[0].order);
        setDay(0);
      }
    } catch (e) {
      setRegenErr(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setRegenBusy(false);
    }
  }

  function saveTrip() {
    if (!trip) return;
    setSaveError("");
    let session = auth;
    if (!session) {
      const nick = nickDraft.trim();
      if (nick.length < 2 || nick.length > 12) {
        setSaveError("닉네임 2~12자를 입력한 뒤 찜해 주세요");
        return;
      }
      session = loginLocal(nick);
      setAuth(session);
      setNickDraft("");
    }
    if (!session) return;
    const scored = {
      ...withTrip(trip, trip.steps, { origin, destination }),
      dispersion: trip.dispersion || scoreTripDispersion(trip.steps),
    };
    saveTripForUser(session.userId, scored);
    setTrip(scored);
    const stamped = stampQuietRegionsFromTrip(
      scored.id,
      scored.steps.map((s) => s.spot.region)
    );
    const added = stamped.stamps.filter((s) =>
      scored.steps.some((st) => st.spot.region === s.region)
    ).length;
    setSavedMsg(
      added
        ? `찜했어요 · 한산 여권 스탬프 ${added}곳`
        : "찜 목록에 저장했어요"
    );
  }

  if (!trip?.steps?.length) {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--outline)] bg-white/94 p-6 text-center">
        <h1 className="m-0 text-xl font-bold text-mountain-deep">실시간 코스</h1>
        <p className="mt-2 text-sm text-muted">아래에서 코스를 생성하거나 지도에서 물어보세요.</p>
        <div className="mx-auto mt-4 flex max-w-md gap-2">
          <input
            className="ui-field flex-1"
            value={regen}
            onChange={(e) => setRegen(e.target.value)}
            placeholder="예: 서울에서 영월 1박2일"
            disabled={regenBusy}
          />
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            disabled={regenBusy || regen.trim().length < 2}
            onClick={() => void regenerate()}
          >
            {regenBusy ? "짜는 중…" : "생성"}
          </button>
        </div>
        {regenErr ? (
          <p className="mt-2 text-sm text-red-700">{regenErr}</p>
        ) : null}
        <Link href="/" className="ui-btn mt-3">
          홈에서 짜기
        </Link>
      </div>
    );
  }

  const routeOrigin =
    origin ||
    (visible[0]
      ? { name: visible[0].spot.name, lat: visible[0].spot.lat, lng: visible[0].spot.lng }
      : null);
  const routeDest =
    destination ||
    (visible.length
      ? {
          name: visible[visible.length - 1].spot.name,
          lat: visible[visible.length - 1].spot.lat,
          lng: visible[visible.length - 1].spot.lng,
        }
      : null);

  const externalLink = kakaoMapLink(routeSteps, {
    from: origin || routeOrigin,
    to: destination || routeDest,
    mode,
  });

  const wxLine = Object.entries(wx)
    .slice(0, 4)
    .map(([r, v]) => `${r.replace(/(시|군)$/, "")} ${Math.round(v.temp)}°`)
    .join(" · ");

  return (
    <div className="space-y-4">
      {/* 실시간 코스 재생성 */}
      <div className="rounded-[var(--radius)] border border-sea/30 bg-sea-mist/50 p-3">
        <p className="m-0 text-[0.72rem] font-semibold text-sea-deep">실시간 코스 생성</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className="ui-field flex-1 !py-2 text-[0.85rem]"
            value={regen}
            onChange={(e) => setRegen(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void regenerate();
            }}
            placeholder="예: 수원 출발 정선·태백 1박2일"
          />
          <button
            type="button"
            disabled={regenBusy}
            onClick={() => void regenerate()}
            className="ui-btn ui-btn-primary shrink-0"
          >
            {regenBusy ? "짜는 중…" : "코스 다시 짜기"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-bold text-mountain-deep">{trip.title}</h1>
          <p className="mt-1 text-sm text-muted">{trip.summary}</p>
          <p className="mt-1 text-[0.7rem] text-muted">
            {routeBusy
              ? "경로 실시간 계산 중…"
              : route
                ? `경로 갱신 ${routeAt || "방금"} · ${
                    route.provider === "kakao"
                      ? "카카오 내비"
                      : route.provider === "osrm"
                        ? "도로 엔진"
                        : "추정"
                  }`
                : "출발·도착을 바꾸면 경로가 다시 계산됩니다"}
            {wxLine ? ` · 날씨 ${wxLine}` : ""}
          </p>
          {routeErr ? (
            <p className="mt-1 text-[0.72rem] text-red-700">{routeErr}</p>
          ) : null}
          {regenErr ? (
            <p className="mt-1 text-[0.72rem] text-red-700">{regenErr}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg bg-sea-soft px-2 py-1 text-[0.7rem] font-bold text-sea-deep">
            {trip.duration}
          </span>
          <span className="rounded-lg bg-mountain-soft px-2 py-1 text-[0.7rem] font-bold text-mountain-deep">
            한산 {quietCount}/{trip.steps.length}곳
          </span>
          {dispersion && (
            <span
              className="rounded-lg bg-white px-2 py-1 text-[0.7rem] font-bold text-sea-deep ring-1 ring-sea/25"
              title={dispersion.esgNote}
            >
              분산 {dispersion.score}·{dispersion.grade}
            </span>
          )}
          <button
            type="button"
            onClick={saveTrip}
            className="rounded-lg bg-sea px-3 py-1.5 text-[0.75rem] font-bold text-white"
          >
            ♡ 찜하기
          </button>
        </div>
      </div>
      {!auth ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="ui-field !max-w-[11rem] !py-1.5 text-[0.8rem]"
            value={nickDraft}
            onChange={(e) => setNickDraft(e.target.value)}
            maxLength={12}
            placeholder="닉네임 2~12자 (찜용)"
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTrip();
            }}
          />
          {saveError ? (
            <span className="text-[0.75rem] text-red-700">{saveError}</span>
          ) : (
            <span className="text-[0.7rem] text-muted">찜하면 한산 여권 스탬프가 찍혀요</span>
          )}
        </div>
      ) : null}
      {savedMsg ? (
        <div className="ui-empty !py-3">
          <p className="m-0 text-[0.85rem] font-semibold text-sea-deep">{savedMsg}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Link href="/passport" className="ui-btn ui-btn-primary !min-h-8 !px-3 !text-[0.75rem]">
              여권 보기
            </Link>
            <Link href="/impact" className="ui-btn ui-btn-secondary !min-h-8 !px-3 !text-[0.75rem]">
              임팩트 KPI
            </Link>
            <Link href="/trips" className="ui-btn ui-btn-ghost !min-h-8 !px-3 !text-[0.75rem]">
              찜 목록
            </Link>
          </div>
        </div>
      ) : null}

      {days.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="일차 필터">
          <button
            type="button"
            aria-pressed={day === 0}
            onClick={() => setDay(0)}
            className={
              day === 0
                ? "rounded-lg bg-mountain px-2.5 py-1 text-[0.72rem] font-semibold text-white"
                : "rounded-lg border border-[var(--outline)] bg-white px-2.5 py-1 text-[0.72rem] font-semibold"
            }
          >
            전체
          </button>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={day === d}
              onClick={() => setDay(d)}
              className={
                day === d
                  ? "rounded-lg bg-mountain px-2.5 py-1 text-[0.72rem] font-semibold text-white"
                  : "rounded-lg border border-[var(--outline)] bg-white px-2.5 py-1 text-[0.72rem] font-semibold"
              }
            >
              {d}일차
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-[var(--radius)] border border-[var(--outline)] bg-white/94 p-3">
        <p className="m-0 text-[0.72rem] text-muted">
          출발·도착이 멀면 그 도로 위 명소를, 서울처럼 출발과 도착이 가까우면 일수와 목적에 맞춰 강원을 다녀오는 코스를 고릅니다. 핀은 초록 출발, 경1·경2, 주황 도착입니다.
          {routeNote ? (
            <span className="mt-1 block font-semibold text-sea-deep">{routeNote}</span>
          ) : null}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <PlaceSearchField
            label="출발지"
            value={origin}
            onChange={(p) => persistEnds(p, destination)}
            placeholder="예: 서울역, 수원역…"
          />
          <PlaceSearchField
            label="도착지"
            value={destination}
            onChange={(p) => persistEnds(origin, p)}
            placeholder="예: 강릉역, 서울로 돌아오기"
          />
        </div>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[0.72rem] font-semibold text-muted">이동수단</legend>
          <div className="mt-1 flex flex-wrap gap-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                onClick={() => {
                  setMode(m.id);
                  setTrip((prev) => {
                    if (!prev) return prev;
                    const next = { ...prev, mode: m.id, savedAt: new Date().toISOString() };
                    setCurrentTrip(next);
                    return next;
                  });
                }}
                className={
                  mode === m.id
                    ? "rounded-lg bg-sea px-2.5 py-1.5 text-[0.72rem] font-bold text-white"
                    : "rounded-lg border border-[var(--outline)] bg-white px-2.5 py-1.5 text-[0.72rem] font-semibold"
                }
              >
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="여행 일수">
            <span className="mr-1 text-[0.72rem] font-semibold text-muted">일수</span>
            {STAYS.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={stay === item}
                onClick={() => {
                  setStay(item);
                  setTrip((prev) => {
                    if (!prev) return prev;
                    const next = { ...prev, duration: stayLabel(item), savedAt: new Date().toISOString() };
                    setCurrentTrip(next);
                    return next;
                  });
                }}
                className={
                  stay === item
                    ? "rounded-lg bg-mountain px-2.5 py-1.5 text-[0.72rem] font-bold text-white"
                    : "rounded-lg border border-[var(--outline)] bg-white px-2.5 py-1.5 text-[0.72rem] font-semibold"
                }
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="여행 목적">
            <span className="mr-1 text-[0.72rem] font-semibold text-muted">목적</span>
            {PURPOSES.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={purpose === item}
                onClick={() => setPurpose(item)}
                className={
                  purpose === item
                    ? "rounded-lg bg-sea px-2.5 py-1.5 text-[0.72rem] font-bold text-white"
                    : "rounded-lg border border-[var(--outline)] bg-white px-2.5 py-1.5 text-[0.72rem] font-semibold"
                }
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {route && route.provider === "straight" && (
        <p className="rounded-[var(--radius)] border border-dashed border-sea/30 bg-sea-mist/50 px-3 py-2 text-[0.75rem] text-muted">
          도로 엔진 응답이 없어 직선으로 보여 드려요. 카카오맵 길찾기로 확인하세요.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.15fr]">
        <div className="order-2 space-y-2 lg:order-1">
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 text-[0.72rem] font-bold uppercase tracking-wide text-muted">
              경유 타임라인
            </p>
            {routeBusy ? (
              <span className="text-[0.68rem] text-muted">경로 계산 중…</span>
            ) : route ? (
              <span className="text-[0.68rem] font-semibold text-sea-deep">
                이동 {route.duration_label} · {route.distance_label}
              </span>
            ) : null}
          </div>

          {origin && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[0.75rem] font-semibold text-emerald-900">
              출발 · {origin.name}
            </p>
          )}

          {visible.map((step, idx) => {
            const leg = route?.legs?.[origin ? idx + 1 : idx];
            const quiet = isQuietRegion(step.spot.region);
            const temp = wx[step.spot.region]?.temp;
            return (
              <div
                key={step.order}
                className={
                  step.order === focus
                    ? "rounded-xl border-2 border-sea bg-sea-mist p-3.5"
                    : "rounded-xl border border-[var(--outline)] bg-white/94 p-3.5"
                }
              >
                <button type="button" className="w-full text-left" onClick={() => setFocus(step.order)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.68rem] font-bold text-sea">
                      STEP {String(step.order).padStart(2, "0")} · {step.day}일차
                      {quiet ? " · 한산" : ""}
                      {temp != null ? ` · ${Math.round(temp)}°` : ""}
                    </span>
                    <span className="text-[0.68rem] text-muted">{step.stay}분</span>
                  </div>
                  <strong className="mt-1 block text-[0.95rem]">{step.spot.name}</strong>
                  <p className="mt-0.5 text-[0.75rem] text-muted">
                    {step.spot.region} · {step.spot.theme}
                  </p>
                  {step.why ? (
                    <p className="mt-1 text-[0.72rem] leading-snug text-on-surface/80">
                      {step.why}
                    </p>
                  ) : null}
                  {step.move_to_next ? (
                    <p className="mt-0.5 text-[0.68rem] text-muted">
                      이동 · {step.move_to_next}
                    </p>
                  ) : null}
                  {leg && (
                    <p className="mt-1 text-[0.72rem] text-sea-deep">
                      → {leg.to} · {leg.duration_label} · {leg.distance_label}
                    </p>
                  )}
                </button>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded-md border border-[var(--outline)] px-2 py-0.5 text-[0.65rem] font-semibold"
                    onClick={() => moveStep(step.order, -1)}
                  >
                    위로
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--outline)] px-2 py-0.5 text-[0.65rem] font-semibold"
                    onClick={() => moveStep(step.order, 1)}
                  >
                    아래로
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[var(--outline)] px-2 py-0.5 text-[0.65rem] font-semibold text-red-700"
                    onClick={() => removeStep(step.order)}
                    disabled={trip.steps.length <= 2}
                  >
                    빼기
                  </button>
                </div>
              </div>
            );
          })}

          {destination && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[0.75rem] font-semibold text-amber-900">
              도착 · {destination.name}
            </p>
          )}

          <div className="relative rounded-xl border border-dashed border-sea/40 bg-white/80 p-3">
            <label className="block text-[0.72rem] font-semibold text-muted">
              경유 명소 추가
              <input
                className="ui-field mt-1 !py-1.5"
                value={addQ}
                onChange={(e) => setAddQ(e.target.value)}
                placeholder="명소·시군 검색"
              />
            </label>
            {addHits.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto">
                {addHits.map((s) => (
                  <li key={`${s.name}-${s.lat}`}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-2 py-1.5 text-left text-[0.78rem] hover:bg-sea-mist"
                      onClick={() => addSpot(s)}
                    >
                      <strong>{s.name}</strong>
                      <span className="text-muted"> · {s.region}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="order-1 space-y-3 lg:sticky lg:top-[calc(var(--nav-h)+1rem)] lg:order-2 lg:self-start">
          <TripMap
            steps={routeSteps}
            focusOrder={focus}
            route={route}
            origin={origin}
            destination={destination}
            onAssignPlace={(place, role) => {
              if (role === "origin") persistEnds(place, destination);
              else if (role === "destination") persistEnds(origin, place);
              else {
                addSpot({
                  name: place.name,
                  region: place.region || place.address || "검색",
                  description: place.address || place.name,
                  lat: place.lat,
                  lng: place.lng,
                  theme: "경유",
                });
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            <a
              href={externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg bg-[#FEE500] px-3 py-2 text-[0.78rem] font-bold text-[#191600] hover:brightness-95"
            >
              카카오맵 길찾기
            </a>
            {active && (
              <a
                href={spotMapUrl(active.spot)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex rounded-lg border border-[var(--outline)] bg-white px-3 py-2 text-[0.78rem] font-bold text-mountain-deep hover:bg-sea-mist"
              >
                이 장소만 보기
              </a>
            )}
          </div>
          {active && (
            <div className="rounded-xl border border-[var(--outline)] bg-white/94 p-3.5">
              <p className="m-0 text-[0.68rem] font-bold text-sea">
                STEP {String(active.order).padStart(2, "0")}
                {isQuietRegion(active.spot.region) ? " · 인구감소 권역" : ""}
                {wx[active.spot.region] != null
                  ? ` · 지금 ${Math.round(wx[active.spot.region].temp)}°`
                  : ""}
              </p>
              <h2 className="mt-1 text-lg font-bold">{active.spot.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {active.spot.region} · {active.spot.description}
              </p>
              <p className="mt-2 text-sm">{active.why}</p>
            </div>
          )}
        </aside>
      </div>

      {dispersion && (
        <aside className="rounded-[var(--radius)] border border-sea/20 bg-sea-mist/40 px-3.5 py-3">
          <DispersionScoreBar dispersion={dispersion} />
          <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">
            {dispersion.esgNote}
          </p>
          <p className="mt-1.5 text-[0.7rem] text-muted">
            <Link href="/impact" className="font-semibold text-sea hover:underline">
              지자체 임팩트 지표
            </Link>
            {" · "}
            <Link href="/passport" className="font-semibold text-sea hover:underline">
              한산 여권
            </Link>
          </p>
        </aside>
      )}

      {benefit && <LocalBenefits benefit={benefit} />}

      {active && (
        <MerchantNearStop
          lat={active.spot.lat}
          lng={active.spot.lng}
          region={active.spot.region}
          spotName={active.spot.name}
        />
      )}
    </div>
  );
}
