"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QUIET_REGIONS } from "@/lib/prefs";
import {
  loadPassport,
  passportProgress,
  passportTier,
  type QuietPassport,
} from "@/lib/passport";
import { loadSavedTrips, loadAuth } from "@/lib/storage";
import { scoreTripDispersion } from "@/lib/impactScore";
import { loadBenefitCtr } from "@/lib/benefits";
import { formatWon } from "@/lib/formatWon";
import type { TripPlan } from "@/lib/tripTypes";
import { PassportStampMap } from "@/components/PassportStampMap";
import { GangwonPayReceiptMock } from "@/components/GangwonPayReceiptMock";
import { loadPayReceipts, payReceiptTotals } from "@/lib/payReceipts";

export function PassportBoard() {
  const [passport, setPassport] = useState<QuietPassport | null>(null);
  const [payTotal, setPayTotal] = useState(0);

  function reload() {
    setPassport(loadPassport());
    setPayTotal(payReceiptTotals(loadPayReceipts()).amount);
  }

  useEffect(() => {
    reload();
  }, []);

  const progress = passportProgress();
  const tier = passportTier(progress.collected);

  if (!passport) {
    return (
      <div className="animate-pulse rounded-[var(--radius)] border border-[var(--outline)] bg-white/80 p-8" />
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="m-0 text-[0.72rem] font-bold tracking-wide text-sea">
          리텐션 · 게이미피케이션
        </p>
        <h1 className="mt-1 text-xl font-bold text-mountain-deep">한산 여권</h1>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">
          인구감소 권역이 일정에 담길 때마다 스탬프가 쌓입니다. 강원페이 영수증을
          남기면 한산 권역 소비까지 여권에 연결됩니다.
        </p>
      </header>

      <section className="rounded-[var(--radius)] border border-mountain/15 bg-white/94 px-4 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="m-0 text-[0.68rem] font-semibold text-muted">등급</p>
            <strong className="text-lg text-mountain-deep">{tier.tier}</strong>
            <p className="mt-1 text-[0.78rem] text-muted">{tier.blurb}</p>
          </div>
          <div className="text-right">
            <p className="m-0 text-[1.6rem] font-bold tabular-nums text-sea-deep">
              {progress.collected}
              <span className="text-base font-semibold text-muted">
                /{progress.total}
              </span>
            </p>
            <p className="m-0 text-[0.7rem] text-muted">한산 시·군 스탬프</p>
            {payTotal > 0 ? (
              <p className="mt-1 m-0 text-[0.68rem] font-semibold text-sea">
                강원페이 {formatWon(payTotal)}
              </p>
            ) : null}
          </div>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-mountain-soft"
          role="progressbar"
          aria-valuenow={progress.collected}
          aria-valuemin={0}
          aria-valuemax={progress.total}
        >
          <div
            className="h-full rounded-full bg-sea transition-[width]"
            style={{ width: `${Math.round(progress.ratio * 100)}%` }}
          />
        </div>
      </section>

      <PassportStampMap stamps={passport.stamps} />

      <GangwonPayReceiptMock onStamped={reload} />

      <section>
        <h2 className="m-0 text-[0.85rem] font-bold text-mountain-deep">
          시·군 스탬프
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUIET_REGIONS.map((region) => {
            const stamp = passport.stamps.find((s) => s.region === region);
            const short = region.replace(/(시|군)$/, "");
            return (
              <li
                key={region}
                className={
                  stamp
                    ? "rounded-[var(--radius-sm)] border border-sea/30 bg-sea-mist/50 px-3 py-3"
                    : "rounded-[var(--radius-sm)] border border-dashed border-[var(--outline)] bg-white/70 px-3 py-3 opacity-70"
                }
              >
                <strong className="block text-[0.9rem] text-mountain-deep">
                  {short}
                </strong>
                <span className="text-[0.68rem] text-muted">
                  {stamp ? `${stamp.count}회 · 일정/영수증 반영` : "미방문"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-[0.75rem] text-muted">
        일정을{" "}
        <Link href="/planner" className="font-semibold text-sea hover:underline">
          찜
        </Link>
        하거나 강원페이 영수증을 기록하면 스탬프가 찍힙니다. 지자체 설득용 지표는{" "}
        <Link href="/impact" className="font-semibold text-sea hover:underline">
          임팩트
        </Link>
        에서 볼 수 있어요.
      </p>
    </div>
  );
}

export function ImpactBoard() {
  const [trips, setTrips] = useState<TripPlan[]>([]);
  const [passport, setPassport] = useState<QuietPassport | null>(null);
  const [ctrTotal, setCtrTotal] = useState(0);
  const [pay, setPay] = useState<{
    ok: boolean;
    note?: string;
    period?: { from: string; to: string };
    totalAmount: number;
    quietAmount: number;
    quietSharePct: number;
    regions: Array<{
      region: string;
      code?: string;
      amount: number;
      count: number;
      quiet: boolean;
    }>;
  } | null>(null);
  const [payLoading, setPayLoading] = useState(true);

  useEffect(() => {
    const auth = loadAuth();
    const list = auth ? loadSavedTrips(auth.userId) : [];
    setTrips(list);
    setPassport(loadPassport());
    setCtrTotal(loadBenefitCtr().total);
    setPayLoading(true);
    fetch("/api/komsco/payments")
      .then((r) => r.json())
      .then((d) => setPay(d))
      .catch(() =>
        setPay({
          ok: false,
          note: "결제 데이터를 불러오지 못했어요. 잠시 후 다시 시도하세요.",
          totalAmount: 0,
          quietAmount: 0,
          quietSharePct: 0,
          regions: [],
        })
      )
      .finally(() => setPayLoading(false));
  }, []);

  const kpis = useMemo(() => {
    const allSteps = trips.flatMap((t) => t.steps);
    const quietStops = allSteps.filter((s) =>
      (QUIET_REGIONS as readonly string[]).includes(s.spot.region)
    ).length;
    const scores = trips.map((t) => scoreTripDispersion(t.steps).score);
    const avgScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    const regionHits = new Map<string, number>();
    for (const s of allSteps) {
      if (!(QUIET_REGIONS as readonly string[]).includes(s.spot.region)) continue;
      regionHits.set(s.spot.region, (regionHits.get(s.spot.region) || 0) + 1);
    }
    const topRegions = [...regionHits.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      tripCount: trips.length,
      quietStops,
      totalStops: allSteps.length,
      quietShare: allSteps.length
        ? Math.round((quietStops / allSteps.length) * 100)
        : 0,
      avgScore,
      stampCount: passport?.stamps.length || 0,
      totalQuietVisits: passport?.totalQuietVisits || 0,
      topRegions,
      ctrTotal,
    };
  }, [trips, passport, ctrTotal]);

  const kpiCards = [
    {
      label: "저장된 분산 일정",
      value: `${kpis.tripCount}`,
      hint: "사용자 찜 코스 수",
    },
    {
      label: "한산 스팟 비중",
      value: `${kpis.quietShare}%`,
      hint: `${kpis.quietStops}/${kpis.totalStops || 0} 스탑`,
    },
    {
      label: "평균 분산 점수",
      value: `${kpis.avgScore}`,
      hint: "저밀도·인접 동선 ESG",
    },
    {
      label: "혜택 링크 클릭",
      value: `${kpis.ctrTotal}`,
      hint: "지역 혜택·가맹 안내 탭 수",
    },
  ];

  return (
    <div className="space-y-5">
      <header>
        <p className="m-0 text-[0.72rem] font-bold tracking-wide text-sea">B2G · 성과 지표</p>
        <h1 className="mt-1 text-xl font-bold text-mountain-deep">임팩트 대시보드</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
          지자체가 예산·혜택을 지원하도록 설득할 때 쓰는 KPI 프로토타입입니다. 실제 서비스에서는
          서버 집계·익명화 이동 데이터로 확장합니다. 지금은 이 브라우저에 저장된 일정·여권으로
          미리보기를 보여 줍니다.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((c) => (
          <article
            key={c.label}
            className="rounded-[var(--radius)] border border-[var(--outline)] bg-white/94 px-3.5 py-3"
          >
            <p className="m-0 text-[0.68rem] font-semibold text-muted">{c.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-mountain-deep">{c.value}</p>
            <p className="mt-0.5 text-[0.7rem] text-muted">{c.hint}</p>
          </article>
        ))}
      </section>

      {kpis.tripCount === 0 ? (
        <p className="m-0 rounded-[var(--radius-sm)] border border-dashed border-[var(--outline)] bg-white/80 px-3 py-2.5 text-[0.75rem] text-muted">
          아직 저장된 일정이 없어요.{" "}
          <Link href="/planner" className="font-semibold text-sea hover:underline">
            플래너
          </Link>
          에서 코스를 찜하면 위 수치가 채워집니다.
        </p>
      ) : null}

      <section className="rounded-[var(--radius)] border border-[var(--outline)] bg-white/94 px-4 py-4">
        <h2 className="m-0 text-[0.85rem] font-bold text-mountain-deep">
          필수 KPI 체크리스트 (제안서 Phase 2)
        </h2>
        <ul className="mt-3 space-y-2 text-[0.8rem] leading-relaxed text-on-surface">
          <li>
            <strong>분산 전환율</strong> — 해안 핫플 검색 → 인접 한산 권역 일정 확정 비율
          </li>
          <li>
            <strong>한산 체류 스탑 수·비중</strong> — 인구감소 시·군 스팟 / 전체 스탑
          </li>
          <li>
            <strong>인접 동선 준수율</strong> — 시·군 간 점프 없는 레그 비율 (뺑뺑이 방지)
          </li>
          <li>
            <strong>지역화폐·관광주민증 CTR</strong> — 혜택 안내 노출 대비 클릭·연동
          </li>
          <li>
            <strong>재방문·여권 스탬프</strong> — 동일 사용자 한산 시·군 누적 커버리지
          </li>
          <li>
            <strong>저밀도 ESG 점수 분포</strong> — A/B 등급 코스 비중 (혼잡 완화 기여)
          </li>
        </ul>
      </section>

      {kpis.topRegions.length > 0 && (
        <section className="rounded-[var(--radius)] border border-[var(--outline)] bg-white/94 px-4 py-4">
          <h2 className="m-0 text-[0.85rem] font-bold text-mountain-deep">
            한산 권역별 일정 스탑 (로컬)
          </h2>
          <ol className="mt-3 space-y-1.5">
            {kpis.topRegions.map(([region, n]) => (
              <li
                key={region}
                className="flex justify-between text-[0.8rem] text-on-surface"
              >
                <span>{region}</span>
                <span className="font-semibold tabular-nums text-sea-deep">{n}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="rounded-[var(--radius)] border border-sea/20 bg-white/94 px-4 py-4">
        <h2 className="m-0 text-[0.85rem] font-bold text-mountain-deep">
          지역사랑상품권 결제 (조폐공사)
        </h2>
        <p className="mt-1 text-[0.75rem] text-muted">
          강원 시·군 결제금액·건수 집계. B2G 설득용 실데이터 매시업.
          {pay?.period
            ? ` · 기준 ${pay.period.from}~${pay.period.to}`
            : ""}
        </p>
        {!pay && payLoading ? (
          <p className="mt-3 text-[0.8rem] text-muted">불러오는 중…</p>
        ) : !pay ? (
          <p className="mt-3 text-[0.8rem] text-muted">결제 데이터 없음</p>
        ) : (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded-[var(--radius-sm)] border border-[var(--outline)] px-3 py-2">
                <p className="m-0 text-[0.65rem] text-muted">강원 결제액</p>
                <p className="m-0 text-lg font-bold tabular-nums text-mountain-deep">
                  {formatWon(pay.totalAmount)}
                </p>
              </div>
              <div className="rounded-[var(--radius-sm)] border border-[var(--outline)] px-3 py-2">
                <p className="m-0 text-[0.65rem] text-muted">한산 권역 결제액</p>
                <p className="m-0 text-lg font-bold tabular-nums text-sea-deep">
                  {formatWon(pay.quietAmount)}
                </p>
              </div>
              <div className="rounded-[var(--radius-sm)] border border-[var(--outline)] px-3 py-2">
                <p className="m-0 text-[0.65rem] text-muted">한산 비중</p>
                <p className="m-0 text-lg font-bold tabular-nums text-mountain-deep">
                  {pay.quietSharePct}%
                </p>
              </div>
            </div>
            {pay.regions?.length > 0 && (
              <ol className="mt-3 max-h-48 space-y-1 overflow-y-auto">
                {pay.regions.slice(0, 12).map((r) => (
                  <li
                    key={r.code ?? r.region}
                    className="flex justify-between gap-2 text-[0.78rem] text-on-surface"
                  >
                    <span>
                      {r.region}
                      {r.quiet ? (
                        <span className="ml-1 text-[0.65rem] text-sea">한산</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {formatWon(r.amount)} · {r.count.toLocaleString("ko-KR")}건
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {!pay.ok && (
              <p className="mt-2 text-[0.72rem] text-muted">
                {pay.note ||
                  "공공데이터포털 일반 인증키를 web/.env.local 에 DATA_GO_KR_SERVICE_KEY(또는 TOUR_API_SERVICE_KEY)로 넣으세요. TourAPI와 같은 키입니다."}
              </p>
            )}
          </>
        )}
      </section>

      <p className="text-[0.75rem] text-muted">
        이 화면 KPI는 브라우저에 저장된 일정·여권·혜택 클릭과 조폐공사 결제
        집계입니다. 홈·채팅의 날씨·축제는 별도 매시업입니다.{" "}
        <Link href="/passport" className="font-semibold text-sea hover:underline">
          한산 여권
        </Link>
        {" · "}
        <Link href="/about" className="font-semibold text-sea hover:underline">
          소개
        </Link>
      </p>
    </div>
  );
}
