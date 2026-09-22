"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, PageHeader, Panel } from "@/components/ui";
import {
  applyDemoSeed,
  clearDemoSeed,
  isDemoSeeded,
} from "@/lib/demoSeed";

type AdminStatus = {
  ok: boolean;
  generatedAt: string;
  dataDir: string;
  dataFileCount: number;
  ssot: {
    present: number;
    total: number;
    files: Array<{ name: string; ok: boolean; bytes: number; mtime: string | null }>;
  };
  catalog: {
    spots: number;
    festivals: number;
    quietGems: number;
    quietRegions: number;
    merchants: number;
  };
  congestionHigh: Array<{ region: string; label: string }>;
  env: {
    kakaoJs: boolean;
    kakaoRest: boolean;
    gemini: boolean;
    dataGoKr: boolean;
  };
  komscoCache: boolean;
};

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <li className="flex items-center justify-between gap-2 text-[0.8rem]">
      <span className="text-on-surface">{label}</span>
      <span
        className={
          on
            ? "font-semibold tabular-nums text-sea-deep"
            : "font-medium text-muted"
        }
      >
        {on ? "OK" : "없음"}
      </span>
    </li>
  );
}

export function AdminBoard() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [flash, setFlash] = useState("");

  const [seedBusy, setSeedBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setStatusError("");
    try {
      const res = await fetch("/api/admin/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "상태 조회 실패");
      setStatus(data as AdminStatus);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "상태 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSeeded(isDemoSeeded());
    void loadStatus();
  }, [loadStatus]);

  async function seed() {
    setSeedBusy(true);
    try {
      const result = await applyDemoSeed();
      setSeeded(true);
      setFlash(
        result.source === "catalog"
          ? `카탈로그 실스팟으로 「${result.tripTitle}」를 채웠어요. 일정·여권·이야기를 확인해 보세요.`
          : `폴백 데모로 「${result.tripTitle}」를 채웠어요.`
      );
      window.setTimeout(() => setFlash(""), 4500);
    } finally {
      setSeedBusy(false);
    }
  }

  function clearSeed() {
    clearDemoSeed();
    setSeeded(false);
    setFlash("데모 시드를 비웠어요.");
    window.setTimeout(() => setFlash(""), 3000);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="관리"
        sub="운영 콘솔 · TourAPI SSOT · 심사 데모"
      />

      {flash ? (
        <p className="m-0 rounded-[var(--radius-sm)] border border-sea/25 bg-sea-mist/60 px-3 py-2 text-[0.78rem] text-mountain-deep">
          {flash}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-[0.85rem] font-bold text-mountain-deep">
            시스템 상태
          </h2>
          <Button variant="secondary" onClick={() => void loadStatus()} disabled={loading}>
            {loading ? "불러오는 중…" : "새로고침"}
          </Button>
        </div>
        {statusError ? (
          <p className="m-0 text-[0.78rem] text-red-700">{statusError}</p>
        ) : null}
        {status ? (
          <Panel className="space-y-4 p-4">
            <p className="m-0 text-[0.72rem] text-muted">
              {status.dataDir} · JSON {status.dataFileCount}개 · SSOT{" "}
              {status.ssot.present}/{status.ssot.total} ·{" "}
              {new Date(status.generatedAt).toLocaleString("ko-KR")}
            </p>
            <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
              <Flag on={status.env.kakaoJs} label="카카오 JS 키" />
              <Flag on={status.env.kakaoRest} label="카카오 REST 키" />
              <Flag on={status.env.gemini} label="Gemini 키" />
              <Flag on={status.env.dataGoKr} label="공공데이터 키" />
              <Flag on={status.komscoCache} label="조폐 결제 캐시" />
            </ul>
            <details className="text-[0.75rem] text-muted">
              <summary className="cursor-pointer font-medium text-on-surface">
                SSOT 파일 목록
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto p-0 pl-1">
                {status.ssot.files.map((f) => (
                  <li key={f.name} className="flex justify-between gap-2">
                    <span className={f.ok ? "" : "text-red-700"}>{f.name}</span>
                    <span className="tabular-nums">
                      {f.ok ? `${Math.round(f.bytes / 1024)}KB` : "없음"}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </Panel>
        ) : (
          <Panel className="animate-pulse p-8" aria-hidden />
        )}
      </section>

      {status ? (
        <section className="space-y-3">
          <h2 className="m-0 text-[0.85rem] font-bold text-mountain-deep">
            카탈로그 요약
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "명소", value: status.catalog.spots },
              { label: "축제", value: status.catalog.festivals },
              { label: "한산 gems", value: status.catalog.quietGems },
              { label: "가맹 시드", value: status.catalog.merchants },
            ].map((c) => (
              <article
                key={c.label}
                className="rounded-[var(--radius)] border border-[var(--outline)] bg-white/94 px-3.5 py-3"
              >
                <p className="m-0 text-[0.68rem] font-semibold text-muted">
                  {c.label}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-mountain-deep">
                  {c.value}
                </p>
              </article>
            ))}
          </div>
          {status.congestionHigh.length > 0 ? (
            <Panel className="p-4">
              <p className="m-0 text-[0.75rem] font-semibold text-mountain-deep">
                혼잡 힌트 상위
              </p>
              <ul className="mt-2 space-y-1 text-[0.78rem] text-on-surface">
                {status.congestionHigh.map((r) => (
                  <li key={r.region} className="flex justify-between gap-2">
                    <span>{r.region}</span>
                    <span className="text-muted">{r.label}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="m-0 text-[0.85rem] font-bold text-mountain-deep">
          심사 데모 시드
        </h2>
        <Panel className="space-y-3 p-4">
          <p className="m-0 text-[0.78rem] leading-relaxed text-muted">
            TourAPI 동기화 카탈로그에서 한산 스팟을 골라 일정·여권·이야기·가맹
            영수증(MOCK)을 이 기기에 채웁니다.
            {seeded ? " · 현재 시드됨" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void seed()} disabled={seedBusy}>
              {seedBusy ? "채우는 중…" : "데모 데이터 채우기"}
            </Button>
            <Button variant="secondary" onClick={clearSeed} disabled={seedBusy}>
              시드 초기화
            </Button>
          </div>
        </Panel>
      </section>

      <section className="space-y-2">
        <h2 className="m-0 text-[0.85rem] font-bold text-mountain-deep">
          빠른 링크
        </h2>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[0.8rem]">
          <Link href="/impact" className="font-semibold text-sea hover:underline">
            임팩트 KPI
          </Link>
          <Link href="/passport" className="font-semibold text-sea hover:underline">
            한산 여권
          </Link>
          <Link href="/community" className="font-semibold text-sea hover:underline">
            이야기
          </Link>
          <Link href="/planner" className="font-semibold text-sea hover:underline">
            일정
          </Link>
          <Link href="/weather" className="font-semibold text-sea hover:underline">
            날씨·혼잡
          </Link>
          <Link href="/" className="font-semibold text-sea hover:underline">
            홈
          </Link>
        </nav>
      </section>
    </div>
  );
}
