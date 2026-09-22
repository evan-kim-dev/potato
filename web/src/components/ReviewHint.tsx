"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { applyDemoSeed, isDemoSeeded } from "@/lib/demoSeed";
import { Button } from "@/components/ui";

const DISMISS_KEY = "gw_review_hint_dismissed";

/** 심사·첫 방문용 한 줄 가이드 (홈 상단) */
export function ReviewHint() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
      setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  async function seed() {
    setBusy(true);
    try {
      const r = await applyDemoSeed();
      setNote(`「${r.tripTitle}」채움 · 여권·임팩트 확인`);
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div className="review-hint shrink-0" role="region" aria-label="체험 가이드">
      <p className="review-hint-text">
        <strong>체험 순서</strong>
        <span aria-hidden> · </span>
        빠른 질문 → 일정 찜 → 여권·임팩트
        {isDemoSeeded() || note ? (
          <span className="text-sea"> · {note || "데모 시드됨"}</span>
        ) : null}
      </p>
      <div className="review-hint-actions">
        <Button
          className="!min-h-7 !px-2.5 !text-[0.68rem]"
          disabled={busy}
          onClick={() => void seed()}
        >
          {busy ? "채우는 중…" : "데모 채우기"}
        </Button>
        <Link href="/admin" className="review-hint-link">
          관리
        </Link>
        <button type="button" className="review-hint-dismiss" onClick={dismiss}>
          닫기
        </button>
      </div>
    </div>
  );
}
