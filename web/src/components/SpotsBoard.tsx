"use client";

import { useMemo, useState } from "react";
import type { Spot } from "@/lib/data";
import { isQuietRegion } from "@/lib/benefits";
import { Chip, Field, PageHeader } from "@/components/ui";

const FALLBACKS = [
  "from-[#3a574a] to-[#7aa3bb]",
  "from-[#2a6a94] to-[#9ec5d8]",
  "from-[#5a7a68] to-[#c5d0cb]",
  "from-[#164866] to-[#d4e6f1]",
];

function SpotThumb({ spot, index }: { spot: Spot; index: number }) {
  const [failed, setFailed] = useState(false);
  const grad = FALLBACKS[index % FALLBACKS.length];

  if (!spot.image || failed) {
    return (
      <div
        className={`flex h-40 w-full items-end bg-gradient-to-br ${grad} px-3.5 pb-3`}
        aria-hidden
      >
        <span className="text-[0.68rem] font-bold tracking-wide text-white/90">
          {spot.theme || "SPOT"}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={spot.image}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-40 w-full object-cover"
    />
  );
}

export function SpotsBoard({
  spots,
  themes,
}: {
  spots: Spot[];
  themes: string[];
}) {
  const [theme, setTheme] = useState("전체");
  const [quietOnly, setQuietOnly] = useState(true);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim();
    const list = spots.filter((s) => {
      if (quietOnly && !isQuietRegion(s.region)) return false;
      if (theme !== "전체" && s.theme !== theme) return false;
      if (!query) return true;
      return `${s.name} ${s.region} ${s.description} ${s.theme}`.includes(query);
    });
    return [...list]
      .map((s) => {
        let score = isQuietRegion(s.region) ? 10 : 0;
        if (s.image) score += 3;
        if (/숲|계곡|동굴|휴양|생태|한산|둘레|자작/.test(`${s.name} ${s.description} ${s.theme}`)) {
          score += 3;
        }
        if (query && `${s.name}${s.region}`.includes(query)) score += 5;
        return { s, score };
      })
      .sort((a, b) => b.score - a.score || a.s.name.localeCompare(b.s.name, "ko"))
      .map((x) => x.s);
  }, [spots, theme, quietOnly, q]);

  return (
    <div>
      <PageHeader
        title="한산 명소"
        sub={
          <>
            <strong className="text-sea">{filtered.length}</strong>곳
            {quietOnly ? "" : " · 전체"}
            {theme !== "전체" ? ` · ${theme}` : ""}
          </>
        }
        action={
          <Field
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름·지역 검색"
            className="max-w-xs"
          />
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Chip mountain on={quietOnly} onClick={() => setQuietOnly((v) => !v)}>
          한산·인구감소 권역
        </Chip>
        {["전체", ...themes].map((t) => (
          <Chip key={t} on={theme === t} onClick={() => setTheme(t)}>
            {t}
          </Chip>
        ))}
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((s, i) => (
          <article key={`${s.region}-${s.name}`} className="ui-media-card">
            <SpotThumb spot={s} index={i} />
            <div className="p-3.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[0.7rem] font-bold text-sea">
                  {s.region}
                  {isQuietRegion(s.region) ? " · 한산" : ""}
                </span>
                <span className="ui-badge">{s.theme}</span>
              </div>
              <h2 className="m-0 text-[0.95rem] font-bold tracking-tight">{s.name}</h2>
              <p className="mt-1.5 line-clamp-2 text-[0.8rem] text-muted">{s.description}</p>
              <a
                href={`/?ask=${encodeURIComponent(
                  isQuietRegion(s.region)
                    ? `${s.name} 포함 한산·인구감소 권역 조용한 여행 코스`
                    : `${s.name}에서 가까운 한산 권역 분산 코스`
                )}`}
                className="ui-link mt-3 inline-flex"
              >
                AI 한산 코스에 넣기 →
              </a>
            </div>
          </article>
        ))}
      </div>

      {!filtered.length && (
        <div className="ui-empty mt-2 text-center">
          <p className="m-0 text-sm text-muted">조건에 맞는 관광지가 없어요.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="ui-btn ui-btn-secondary !min-h-8 !text-[0.75rem]"
              onClick={() => {
                setQuietOnly(false);
                setTheme("전체");
                setQ("");
              }}
            >
              필터 초기화
            </button>
            <a href="/?ask=%ED%95%9C%EC%82%B0%20%EA%B6%8C%EC%97%AD%20%EC%BD%94%EC%8A%A4" className="ui-btn ui-btn-primary !min-h-8 !text-[0.75rem]">
              AI에게 물어보기
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
