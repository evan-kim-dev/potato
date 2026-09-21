"use client";

import Link from "next/link";
import { useState } from "react";
import type { Spot } from "@/lib/data";

function GemThumb({ spot }: { spot: Spot }) {
  const [failed, setFailed] = useState(false);
  if (!spot.image || failed) {
    return (
      <div className="h-[4.5rem] w-full bg-gradient-to-br from-sea-soft to-mountain-soft" aria-hidden />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={spot.image}
      alt=""
      width={148}
      height={72}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-[4.5rem] w-full object-cover"
    />
  );
}

function GemCard({ spot }: { spot: Spot }) {
  return (
    <Link
      href={`/?ask=${encodeURIComponent(`${spot.name} 포함 조용한 여행 코스`)}`}
      className="quiet-gem-card w-[148px] shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--outline)] bg-white transition hover:border-sea/30"
    >
      <GemThumb spot={spot} />
      <div className="px-2.5 py-2">
        <span className="block text-[0.7rem] font-medium text-muted">
          {spot.region.replace(/(시|군)$/, "")}
        </span>
        <strong className="mt-0.5 line-clamp-2 block text-[0.82rem] font-semibold leading-snug text-on-surface">
          {spot.name}
        </strong>
      </div>
    </Link>
  );
}

export function QuietGems({ gems }: { gems: Spot[] }) {
  if (!gems.length) return null;

  const base =
    gems.length >= 4
      ? gems
      : [...gems, ...gems, ...gems].slice(0, Math.max(6, gems.length * 2));
  const track = [...base, ...base];
  const durationSec = Math.max(22, base.length * 5);

  return (
    <section className="shrink-0" aria-labelledby="quiet-gems-title">
      <h2
        id="quiet-gems-title"
        className="m-0 text-[0.9rem] font-semibold tracking-tight text-mountain-deep"
      >
        한산한 명소
      </h2>
      <div className="quiet-gems-marquee mt-2.5">
        <div className="quiet-gems-track" style={{ animationDuration: `${durationSec}s` }}>
          {track.map((g, i) => (
            <GemCard key={`${g.region}-${g.name}-${i}`} spot={g} />
          ))}
        </div>
      </div>
    </section>
  );
}
