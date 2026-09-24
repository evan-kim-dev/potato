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
import { Button, EmptyState, Field, PageHeader } from "@/components/ui";

export function TripsBoard() {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [trips, setTrips] = useState<TripPlan[]>([]);
  const [nick, setNick] = useState("");

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

  function startWithNick() {
    const name = nick.trim();
    if (name.length < 2 || name.length > 12) return;
    const session = loginLocal(name);
    setAuth(session);
    setNick("");
    refresh(session);
  }

  function openTrip(trip: TripPlan) {
    setCurrentTrip(trip);
    router.push("/planner");
  }

  function removeTrip(id: string) {
    if (!auth) return;
    const next = deleteTripForUser(auth.userId, id);
    setTrips(next);
  }

  if (!auth) {
    return (
      <div className="space-y-4">
        <PageHeader title="찜한 일정" sub="닉네임으로 시작하면 이 기기에 코스가 저장돼요." />
        <EmptyState
          action={
            <form
              className="flex w-full max-w-xs flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                startWithNick();
              }}
            >
              <Field
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                placeholder="닉네임 2~12자"
                maxLength={12}
                aria-label="닉네임"
              />
              <Button type="submit" disabled={nick.trim().length < 2}>
                닉네임으로 시작
              </Button>
            </form>
          }
        >
          <p className="m-0 text-[0.8rem] text-muted">
            이 기기에만 저장됩니다. 닉네임을 입력하면 찜한 코스를 볼 수 있어요.
          </p>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="찜한 일정"
        sub={`${auth.name}님 · ${trips.length}개`}
        action={
          <Link href="/planner" className="text-[0.78rem] font-bold text-sea hover:underline">
            현재 일정 →
          </Link>
        }
      />

      {trips.length === 0 ? (
        <EmptyState
          action={
            <Link href="/" className="ui-btn ui-btn-primary">
              홈에서 코스 만들기
            </Link>
          }
        >
          <p className="m-0 text-[0.8rem] text-muted">
            아직 찜한 일정이 없어요. AI 코스를 만든 뒤 플래너에서 저장해 보세요.
          </p>
        </EmptyState>
      ) : null}

      <div className="space-y-3">
        {trips.map((t) => {
          const d = t.dispersion || scoreTripDispersion(t.steps || []);
          return (
          <article
            key={t.id}
            className="rounded-[var(--radius)] border border-[var(--outline)] bg-white/94 p-3.5"
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
                <Button
                  className="!min-h-8 !px-3 !text-[0.72rem]"
                  onClick={() => openTrip(t)}
                >
                  열기
                </Button>
                <Button
                  variant="ghost"
                  className="!min-h-8 !px-3 !text-[0.72rem]"
                  onClick={() => removeTrip(t.id)}
                >
                  삭제
                </Button>
              </div>
            </div>
          </article>
          );
        })}
      </div>
    </div>
  );
}
