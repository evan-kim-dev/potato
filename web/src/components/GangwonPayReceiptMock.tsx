"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QUIET_REGIONS } from "@/lib/prefs";
import {
  clearPayReceipts,
  loadPayReceipts,
  payReceiptTotals,
  savePayReceipt,
  type PayReceipt,
} from "@/lib/payReceipts";
import { formatWon } from "@/lib/formatWon";
import { stampQuietRegionsFromTrip } from "@/lib/passport";

type SampleMerchant = {
  name: string;
  region: string;
  amount: number;
};

const SAMPLES: SampleMerchant[] = [
  { name: "영월 동강 막국수", region: "영월군", amount: 18000 },
  { name: "청령포 쉼터 카페", region: "영월군", amount: 9500 },
  { name: "정선 아리랑 시장 분식", region: "정선군", amount: 12000 },
  { name: "태백산 산채정식", region: "태백시", amount: 22000 },
  { name: "인제 자작나무 숲 카페", region: "인제군", amount: 11000 },
  { name: "양구 파로호 식당", region: "양구군", amount: 16000 },
];

type Props = {
  onStamped?: () => void;
};

function todayLabel() {
  return new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 강원페이 영수증 첨부·기록 목업 */
export function GangwonPayReceiptMock({ onStamped }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [receipts, setReceipts] = useState<PayReceipt[]>([]);
  const [draft, setDraft] = useState<SampleMerchant>(SAMPLES[0]);
  const [attachName, setAttachName] = useState("영수증_미리보기.jpg");
  const [flash, setFlash] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReceipts(loadPayReceipts());
  }, []);

  const totals = useMemo(() => payReceiptTotals(receipts), [receipts]);

  function refresh() {
    setReceipts(loadPayReceipts());
  }

  function applySample(i: number) {
    const s = SAMPLES[i % SAMPLES.length];
    setDraft(s);
    setAttachName(`강원페이_${s.region}_${s.name.slice(0, 6)}.jpg`);
  }

  function onFile(file: File | null) {
    if (!file) return;
    setAttachName(file.name);
    // 파일명에서 대충 가맹 힌트 (목업)
    const hit = SAMPLES.find((s) => file.name.includes(s.region.replace(/(시|군)$/, "")));
    if (hit) setDraft(hit);
    setFlash("영수증 이미지가 첨부됐어요 (로컬 목업 · 서버 업로드 없음)");
    window.setTimeout(() => setFlash(""), 2800);
  }

  function record() {
    setBusy(true);
    try {
      const paidAt = new Date().toISOString();
      const saved = savePayReceipt({
        merchant: draft.name,
        region: draft.region,
        amount: draft.amount,
        paidAt,
        attachment: attachName,
        note: "강원페이 결제 목업 · 한산 권역 소비 기록",
      });

      // 한산 권역이면 여권 스탬프도 연동(목업)
      if ((QUIET_REGIONS as readonly string[]).includes(draft.region)) {
        stampQuietRegionsFromTrip(`pay-${saved.id}`, [draft.region]);
        onStamped?.();
      }

      refresh();
      setFlash("강원페이 결제가 한산 여권 스탬프에 반영됐어요");
      window.setTimeout(() => setFlash(""), 3200);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pay-receipt-card" aria-label="강원페이 영수증 연동 목업">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="m-0 text-[0.65rem] font-bold tracking-wide text-sea">
            MOCK · 강원페이 연동
          </p>
          <h2 className="mt-0.5 m-0 text-[0.9rem] font-bold text-mountain-deep">
            영수증 첨부 → 소비 기록
          </h2>
          <p className="mt-1 m-0 max-w-md text-[0.72rem] leading-relaxed text-muted">
            한산 권역 가맹점에서 강원페이로 결제한 뒤 영수증을 남기면, 여권
            스탬프와 연결되는 흐름 목업입니다. 실제 결제 API는 아닙니다.
          </p>
        </div>
        <div className="text-right">
          <p className="m-0 text-[1.15rem] font-bold tabular-nums text-sea-deep">
            {formatWon(totals.amount)}
          </p>
          <p className="m-0 text-[0.65rem] text-muted">
            {totals.count}건 · {totals.regions}개 권역
          </p>
        </div>
      </div>

      <div className="pay-receipt-layout">
        <div className="pay-receipt-slip" aria-hidden={false}>
          <div className="pay-receipt-slip-head">
            <span>강원페이</span>
            <span>RECEIPT</span>
          </div>
          <p className="pay-receipt-slip-store">{draft.name}</p>
          <p className="pay-receipt-slip-meta">
            {draft.region} · {todayLabel()}
          </p>
          <div className="pay-receipt-slip-row">
            <span>결제수단</span>
            <strong>강원페이</strong>
          </div>
          <div className="pay-receipt-slip-row">
            <span>금액</span>
            <strong>{formatWon(draft.amount)}</strong>
          </div>
          <div className="pay-receipt-slip-attach">
            <span className="pay-receipt-clip" aria-hidden />
            <span className="truncate">{attachName}</span>
          </div>
          <p className="pay-receipt-slip-foot">※ 목업 영수증 · 제출용 시연</p>
        </div>

        <div className="pay-receipt-form">
          <label className="pay-receipt-label">
            가맹점 샘플
            <select
              className="ui-field mt-1 !py-1.5 text-[0.78rem]"
              value={`${draft.name}|${draft.region}|${draft.amount}`}
              onChange={(e) => {
                const i = SAMPLES.findIndex(
                  (s) => `${s.name}|${s.region}|${s.amount}` === e.target.value
                );
                if (i >= 0) applySample(i);
              }}
            >
              {SAMPLES.map((s) => (
                <option
                  key={s.name}
                  value={`${s.name}|${s.region}|${s.amount}`}
                >
                  {s.region.replace(/(시|군)$/, "")} · {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="pay-receipt-label">
            금액 (원)
            <input
              type="number"
              min={1000}
              step={500}
              className="ui-field mt-1 !py-1.5 text-[0.78rem]"
              value={draft.amount}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  amount: Math.max(0, Number(e.target.value) || 0),
                }))
              }
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="rounded-[var(--radius-sm)] border border-[var(--outline)] bg-white px-3 py-2 text-[0.72rem] font-semibold text-mountain-deep"
              onClick={() => fileRef.current?.click()}
            >
              영수증 첨부
            </button>
            <button
              type="button"
              className="ui-btn ui-btn-primary !min-h-9 !px-3 !text-[0.72rem]"
              disabled={busy || !draft.amount}
              onClick={record}
            >
              강원페이로 기록
            </button>
          </div>

          {flash ? (
            <p className="m-0 text-[0.72rem] font-medium text-sea">{flash}</p>
          ) : (
            <p className="m-0 text-[0.68rem] text-muted">
              첨부 후 기록하면 한산 권역 여권 도장과 연동됩니다
            </p>
          )}
        </div>
      </div>

      {receipts.length > 0 ? (
        <div className="pay-receipt-list">
          <div className="flex items-center justify-between gap-2">
            <h3 className="m-0 text-[0.78rem] font-bold text-mountain-deep">
              기록된 영수증
            </h3>
            <button
              type="button"
              className="text-[0.68rem] font-semibold text-muted hover:text-sea"
              onClick={() => {
                clearPayReceipts();
                refresh();
              }}
            >
              비우기
            </button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {receipts.slice(0, 6).map((r) => (
              <li key={r.id} className="pay-receipt-row">
                <div className="min-w-0">
                  <strong className="block truncate text-[0.78rem] text-on-surface">
                    {r.merchant}
                  </strong>
                  <span className="text-[0.65rem] text-muted">
                    {r.region} · {r.attachment}
                  </span>
                </div>
                <span className="shrink-0 text-[0.78rem] font-bold tabular-nums text-sea-deep">
                  {formatWon(r.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
