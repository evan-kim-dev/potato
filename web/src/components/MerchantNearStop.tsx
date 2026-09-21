"use client";

import { useEffect, useState } from "react";
import type { LocalMerchant } from "@/lib/merchants";
import { trackBenefitClick } from "@/lib/benefits";

export function MerchantNearStop({
  lat,
  lng,
  region,
  spotName,
}: {
  lat: number;
  lng: number;
  region: string;
  spotName: string;
}) {
  const [items, setItems] = useState<LocalMerchant[]>([]);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<{ needsKakaoKey?: boolean } | null>(null);

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const ac = new AbortController();
    setBusy(true);
    const q = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      region,
      limit: "3",
    });
    fetch(`/api/merchants?${q}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (ac.signal.aborted) return;
        setItems((data.merchants || []) as LocalMerchant[]);
        setMeta(data.meta || null);
      })
      .catch(() => {
        if (!ac.signal.aborted) setItems([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setBusy(false);
      });
    return () => ac.abort();
  }, [lat, lng, region]);

  if (busy && !items.length) {
    return (
      <aside className="merchant-panel animate-pulse" aria-busy>
        <p className="m-0 text-[0.75rem] text-muted">
          {spotName} 근처 지역화폐 가맹점…
        </p>
      </aside>
    );
  }
  if (!items.length) return null;

  return (
    <aside className="merchant-panel animate-[ui-fade-up_0.35s_var(--ease)_both]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-[0.68rem] font-bold tracking-wide text-mountain">
          강원페이 · 로컬 가맹
        </p>
        <span className="text-[0.62rem] font-medium text-muted">
          {spotName} 인근 · 체류 소비
        </span>
      </div>
      <ul className="mt-2.5 space-y-0">
        {items.map((m, i) => (
          <li key={m.id} className="merchant-row">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-mountain-soft text-[0.7rem] font-bold text-mountain-deep">
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-[0.82rem] text-mountain-deep">
                {m.name}
              </strong>
              <span className="text-[0.66rem] text-muted">
                {m.category}
                {m.distanceKm != null ? ` · ${m.distanceKm}km` : ""}
                {m.pay?.length ? ` · ${m.pay.slice(0, 2).join("·")}` : ""}
              </span>
            </div>
            <a
              href={`https://map.kakao.com/link/to/${encodeURIComponent(m.name)},${m.lat},${m.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md bg-sea px-2 py-1 text-[0.68rem] font-bold text-white"
              data-cta="merchant-map"
              onClick={() => trackBenefitClick(`merchant:${m.id}`)}
            >
              길찾기
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-[var(--outline)]/70 pt-2">
        <a
          href="https://www.gwgs.kr.gov.kr/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[0.7rem] font-semibold text-sea hover:underline"
          data-cta="gangwon-pay"
          onClick={() => trackBenefitClick("gangwon-pay-home")}
        >
          강원상품권 안내
        </a>
        {meta?.needsKakaoKey ? (
          <span className="text-[0.65rem] text-muted">시드 가맹 · 카카오 키 시 보강</span>
        ) : null}
      </div>
    </aside>
  );
}
