"use client";

import type { DispersionScore } from "@/lib/impactScore";

export function DispersionScoreBar({
  dispersion,
  compact,
}: {
  dispersion: DispersionScore;
  compact?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, dispersion.score));
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.68rem] font-bold tracking-wide text-sea-deep">
          저밀도 분산
        </span>
        <strong className="text-[0.85rem] tabular-nums text-mountain-deep">
          {dispersion.score}
          <span className="text-[0.7rem] font-semibold text-muted">
            ·{dispersion.grade}
          </span>
        </strong>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-mountain-soft"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`분산 점수 ${dispersion.score}`}
      >
        <div
          className="h-full rounded-full bg-sea transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {!compact && (
        <div className="flex flex-wrap gap-1">
          <span className="rounded-md bg-white px-1.5 py-0.5 text-[0.62rem] font-semibold text-mountain-deep ring-1 ring-[var(--outline)]">
            한산 {dispersion.quietStops}/{dispersion.totalStops}
          </span>
          <span className="rounded-md bg-white px-1.5 py-0.5 text-[0.62rem] font-semibold text-mountain-deep ring-1 ring-[var(--outline)]">
            인접 {dispersion.adjacentLegs}/{Math.max(1, dispersion.totalLegs)}
          </span>
          <span className="rounded-md bg-white px-1.5 py-0.5 text-[0.62rem] font-semibold text-mountain-deep ring-1 ring-[var(--outline)]">
            핫플 {dispersion.coastalHotStops}
          </span>
        </div>
      )}
    </div>
  );
}
