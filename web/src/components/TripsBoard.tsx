"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  deleteTripForUser,
  loadAuth,
  loadSavedTrips,
  loginLocal,
  setCurrentTrip,
  type AuthSession,
} from "@/lib/storage";
import type { TripPlan } from "@/lib/tripTypes";
import { scoreTripDispersion } from "@/lib/impactScore";
import { DispersionScoreBar } from "@/components/DispersionScoreBar";

export function TripsBoard() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [trips, setTrips] = useState<TripPlan[]>([]);

  function refresh(session: AuthSession | null) {
    if (!session) {
      setTrips([]);
      return;
    }
    setTrips(loadSavedTrips(session.userId));
  }

  useEffect(() => {
    const session = loadAuth();
    setAuth(session);
    refresh(session);
  }, []);

  function ensureLogin() {
    let session = auth;
    if (!session) {
      const nick = window.prompt("닉네임을 입력하세요 (2~12자)");
      if (!nick || nick.trim().length < 2) return null;
      session = loginLocal(nick);
      setAuth(session);
    }
    return session;
  }

  function openTrip(trip: TripPlan) {
    setCurrentTrip(trip);
    router.push("/planner");
  }

  function removeTrip(id: string) {
    const session = ensureLogin();
    if (!session) return;
    const next = deleteTripForUser(session.userId, id);
    setTrips(next);
  }

  if (!auth) {
    return (
      <div className="rounded-xl border border-[var(--outline)] bg-white/94 p-6 text-center">
        <h1 className="m-0 text-xl font-bold">찜 목록</h1>
        <p className="mt-2 text-sm text-muted">로그인(닉네임) 후 찜한 코스를 볼 수 있어요.</p>
        <button
          type="button"
          onClick={() => {
            const s = ensureLogin();
            if (s) refresh(s);
          }}
          className="mt-4 rounded-lg bg-sea px-4 py-2 text-sm font-bold text-white"
        >
          닉네임으로 시작
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-xl font-bold text-mountain-deep">찜 목록</h1>
          <p className="mt-1 text-sm text-muted">{auth.name}님 · {trips.length}개</p>
        </div>
        <Link href="/planner" className="text-[0.78rem] font-bold text-sea hover:underline">
          현재 일정 →
        </Link>
      </div>

      <div className="space-y-3">
        {trips.map((t) => {
          const d = t.dispersion || scoreTripDispersion(t.steps || []);
          return (
          <article
            key={t.id}
            className="rounded-xl border border-[var(--outline)] bg-white/94 p-3.5 shadow-sm transition hover:border-sea/25"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="m-0 text-[0.95rem] font-bold">{t.title}</h2>
                <p className="mt-1 text-[0.75rem] text-muted">
                  {t.duration} · {t.stopNames?.slice(0, 4).join(" · ")}
                </p>
                <div className="mt-2 max-w-xs">
                  <DispersionScoreBar dispersion={d} compact />
                </div>
                <p className="mt-1 text-[0.7rem] text-muted">
                  {new Date(t.savedAt).toLocaleString("ko-KR")}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openTrip(t)}
                  className="rounded-lg bg-sea px-3 py-1.5 text-[0.72rem] font-bold text-white"
                >
                  열기
                </button>
                <button
                  type="button"
                  onClick={() => removeTrip(t.id)}
                  className="rounded-lg border border-[var(--outline)] px-3 py-1.5 text-[0.72rem] font-semibold"
                >
                  삭제
                </button>
              </div>
            </div>
          </article>
          );
        })}
        {!trips.length && (
          <p className="rounded-xl border border-[var(--outline)] bg-white p-5 text-sm text-muted">
            찜한 코스가 없어요. 플래너에서 ♡ 찜하기를 눌러 보세요.
          </p>
        )}
      </div>
    </div>
  );
}
