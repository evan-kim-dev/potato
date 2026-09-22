"use client";

import { useEffect, useMemo, useState } from "react";
import type { Festival } from "@/lib/data";
import { isQuietRegion } from "@/lib/benefits";
import { Chip, Field, PageHeader } from "@/components/ui";

function parseYmd(raw?: string) {
  if (!raw || !/^\d{8}$/.test(raw)) return null;
  const y = Number(raw.slice(0, 4));
  const m = Number(raw.slice(4, 6)) - 1;
  const d = Number(raw.slice(6, 8));
  const dt = new Date(y, m, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function festStatus(f: Festival, today: Date): "ongoing" | "upcoming" | "past" | "unknown" {
  const start = parseYmd(f.eventStartDate);
  const end = parseYmd(f.eventEndDate);
  if (!start && !end) return "unknown";
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const s = start?.getTime() ?? t;
  const e = end?.getTime() ?? s;
  if (t < s) return "upcoming";
  if (t > e) return "past";
  return "ongoing";
}

export function FestivalsBoard({ festivals }: { festivals: Festival[] }) {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("전체");
  const [quietOnly, setQuietOnly] = useState(true);
  const [timing, setTiming] = useState<"all" | "live" | "soon">("live");
  const [autoSoon, setAutoSoon] = useState(false);

  const regions = useMemo(
    () => ["전체", ...[...new Set(festivals.map((f) => f.place).filter(Boolean))].sort()],
    [festivals]
  );

  const today = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const query = q.trim();
    const rows = festivals
      .map((f) => {
        const quiet = isQuietRegion(f.place);
        const status = festStatus(f, today);
        let score = quiet ? 10 : 0;
        if (status === "ongoing") score += 8;
        else if (status === "upcoming") score += 5;
        else if (status === "past") score -= 4;
        if (f.image) score += 2;
        return { f, quiet, status, score };
      })
      .filter(({ f, quiet, status }) => {
        if (quietOnly && !quiet) return false;
        if (region !== "전체" && f.place !== region) return false;
        const effectiveTiming = autoSoon && timing === "live" ? "soon" : timing;
        if (effectiveTiming === "live" && status !== "ongoing" && status !== "unknown")
          return false;
        if (
          effectiveTiming === "soon" &&
          status !== "upcoming" &&
          status !== "ongoing"
        )
          return false;
        if (!query) return true;
        return `${f.title} ${f.place} ${f.desc || ""} ${f.period}`.includes(query);
      })
      .sort((a, b) => b.score - a.score || a.f.title.localeCompare(b.f.title, "ko"));
    return rows;
  }, [festivals, region, q, quietOnly, timing, today, autoSoon]);

  useEffect(() => {
    if (timing !== "live" || autoSoon) return;
    const liveCount = festivals.filter((f) => {
      if (quietOnly && !isQuietRegion(f.place)) return false;
      if (region !== "전체" && f.place !== region) return false;
      const st = festStatus(f, today);
      return st === "ongoing" || st === "unknown";
    }).length;
    if (liveCount === 0 && festivals.length > 0) {
      setAutoSoon(true);
    }
  }, [festivals, quietOnly, region, timing, today, autoSoon]);

  return (
    <div>
      <PageHeader
        title="추천 축제"
        sub={
          <>
            한산 권역 우선 · <strong className="text-sea">{filtered.length}</strong>곳
          </>
        }
        action={
          <Field
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="축제·지역 검색"
          />
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        <Chip on={quietOnly} onClick={() => setQuietOnly((v) => !v)}>
          인구감소 권역만
        </Chip>
        <Chip
          on={timing === "live" && !autoSoon}
          onClick={() => {
            setAutoSoon(false);
            setTiming("live");
          }}
        >
          진행·상시
        </Chip>
        <Chip
          on={timing === "soon" || autoSoon}
          onClick={() => {
            setAutoSoon(false);
            setTiming("soon");
          }}
        >
          다가오는
        </Chip>
        <Chip
          on={timing === "all"}
          onClick={() => {
            setAutoSoon(false);
            setTiming("all");
          }}
        >
          전체 기간
        </Chip>
      </div>

      {autoSoon ? (
        <p className="mb-3 m-0 rounded-[var(--radius-sm)] border border-sea/20 bg-sea-mist/40 px-3 py-2 text-[0.75rem] text-sea-deep">
          지금 진행 중 축제가 적어 <strong>다가오는 축제</strong>로 보여 드려요 ·{" "}
          {filtered.length}곳
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {regions.map((r) => (
          <Chip key={r} on={region === r} onClick={() => setRegion(r)}>
            {r}
            {r !== "전체" && isQuietRegion(r) ? " ·한산" : ""}
          </Chip>
        ))}
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(({ f, quiet, status }) => (
          <article key={f.id} className="ui-media-card">
            {f.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.image}
                alt=""
                className="h-40 w-full object-cover"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-40 items-center justify-center bg-gradient-to-br from-sea-soft to-mountain-soft text-sm font-bold text-sea-deep">
                FESTIVAL
              </div>
            )}
            <div className="p-3.5">
              <p className="m-0 flex flex-wrap items-center gap-1.5 text-[0.7rem] font-bold text-sea">
                <span>
                  {f.place} · {f.period}
                </span>
                {quiet && (
                  <span className="rounded bg-mountain-soft px-1.5 py-0.5 text-[0.62rem] text-mountain-deep">
                    한산
                  </span>
                )}
                {status === "ongoing" && (
                  <span className="rounded bg-sea-soft px-1.5 py-0.5 text-[0.62rem] text-sea-deep">
                    진행
                  </span>
                )}
              </p>
              <h2 className="mt-1.5 text-[0.95rem] font-bold tracking-tight">{f.title}</h2>
              {f.desc && (
                <p className="mt-1.5 line-clamp-2 text-[0.8rem] text-muted">{f.desc}</p>
              )}
              <a
                href={`/?ask=${encodeURIComponent(
                  `${f.title}(${f.place}) 포함 한산 권역 여행 코스 추천해줘`
                )}`}
                className="ui-link mt-3 inline-flex"
              >
                AI 코스 만들기 →
              </a>
            </div>
          </article>
        ))}
      </div>

      {!filtered.length && (
        <p className="ui-panel p-6 text-center text-sm text-muted">
          조건에 맞는 축제가 없어요. 「전체 기간」을 켜거나 한산 필터를 풀어 보세요.
        </p>
      )}
    </div>
  );
}
