"use client";

import Link from "next/link";
import type { RegionTip } from "@/lib/data";

/** 해안 혼잡 → 한산 분산 한 줄 CTA */
export function CongestionBanner({ tips }: { tips: Record<string, RegionTip> }) {
  const busy = Object.values(tips).filter((t) => t.congestionLevel === "high");
  const calm = Object.values(tips).filter(
    (t) => t.quiet && t.congestionLevel === "low"
  );
  if (!busy.length || !calm.length) return null;

  const from = busy[0];
  const to = calm.slice(0, 3).map((t) => t.short).join("·");

  return (
    <div className="cong-banner shrink-0 animate-[ui-fade-up_0.5s_var(--ease)_both]">
      <p className="cong-banner-label">지금 분산 추천</p>
      <p className="cong-banner-body">
        <span className="cong-from">{from.short}</span>
        <span className="cong-arrow" aria-hidden>
          →
        </span>
        <span className="cong-to">{to}</span>
      </p>
      <Link
        href={`/?ask=${encodeURIComponent(`${from.short} 대신 ${to} 한산 코스`)}`}
        className="cong-banner-cta"
      >
        온이에게 물어보기
      </Link>
    </div>
  );
}
