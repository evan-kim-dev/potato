"use client";

import { useState } from "react";
import type { ForecastMsgPayload } from "@/lib/data";
import { Button, Chip, PageHeader } from "@/components/ui";

type Payload = ForecastMsgPayload & { source?: string };

function BulletinBody({ text }: { text: string }) {
  return (
    <pre className="fcst-bulletin-body m-0 whitespace-pre-wrap font-sans text-[0.8125rem] leading-[1.55] text-on-surface">
      {text}
    </pre>
  );
}

function BulletinBlock({ title, body }: { title: string; body: string }) {
  if (!body.trim()) return null;
  return (
    <div className="mt-3 border-t border-[var(--outline)] pt-2.5">
      <p className="m-0 text-[0.72rem] font-bold tracking-wide text-mountain-deep">{title}</p>
      <pre className="fcst-bulletin-body mt-1.5 whitespace-pre-wrap font-sans text-[0.78rem] leading-[1.5] text-muted">
        {body}
      </pre>
    </div>
  );
}

export function ForecastBoard({ payload: initial }: { payload: Payload }) {
  const [payload, setPayload] = useState<Payload>(initial);
  const [tab, setTab] = useState<"situation" | "land" | "sea">("situation");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const rows = payload[tab] || [];
  const sourceLabel =
    payload.source === "kma"
      ? "기상청 통보문"
      : payload.source === "open-meteo"
        ? "Open-Meteo 요약"
        : payload.source === "ssot"
          ? "동기화 데이터"
          : "대기";

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/forecast", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `실패 ${res.status}`);
      setPayload(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "통보문 갱신 실패");
    } finally {
      setBusy(false);
    }
  }

  const emptyStub = payload.stub && !rows.some((r) => r.data);

  return (
    <section>
      <PageHeader
        title="단기예보 통보문"
        sub={`강원 영동·영서 기상개황 · 육상·동해 해상예보 · ${sourceLabel}`}
        action={
          <Button variant="secondary" onClick={() => void refresh()} disabled={busy}>
            {busy ? "갱신 중…" : "새로고침"}
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(
          [
            ["situation", "기상개황"],
            ["land", "육상예보"],
            ["sea", "해상예보"],
          ] as const
        ).map(([id, label]) => (
          <Chip key={id} mountain on={tab === id} onClick={() => setTab(id)}>
            {label}
          </Chip>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

      {emptyStub ? (
        <p className="ui-panel p-4 text-sm text-muted">
          {payload.reason ||
            "통보문을 불러오지 못했어요. 잠시 후 새로고침해 주세요."}
        </p>
      ) : (
        <div className="space-y-3">
          {payload.reason && payload.source === "open-meteo" && (
            <p className="rounded-[var(--radius)] border border-sea/20 bg-sea-mist/50 px-3 py-2 text-[0.75rem] text-sea-deep">
              {payload.reason}
            </p>
          )}
          {rows.map((row) => {
            const data = row.data as Record<string, unknown> | null;
            const overview =
              typeof data?.overview === "string" ? data.overview.trim() : "";
            const warning = typeof data?.warning === "string" ? data.warning.trim() : "";
            const preWarning =
              typeof data?.pre_warning === "string" ? data.pre_warning.trim() : "";
            const announced = data?.tmFc || data?.announceTime;

            return (
              <article key={row.label} className="ui-panel overflow-hidden p-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--outline)] bg-[#f4f7f5] px-3.5 py-2.5">
                  <h3 className="m-0 text-sm font-bold text-mountain-deep">{row.label}</h3>
                  {announced ? (
                    <p className="m-0 text-[0.72rem] text-muted">
                      발표 {String(announced)}
                    </p>
                  ) : null}
                </div>

                {!data ? (
                  <p className="px-3.5 py-3 text-sm text-muted">데이터 없음</p>
                ) : (
                  <div className="px-3.5 py-3">
                    {overview ? (
                      <BulletinBody text={overview} />
                    ) : tab === "situation" ? (
                      <p className="m-0 text-sm text-muted">개황 본문이 비어 있어요.</p>
                    ) : null}

                    {tab === "situation" && (
                      <>
                        <BulletinBlock title="특보" body={warning || "특보 정보 없음"} />
                        <BulletinBlock
                          title="예비특보"
                          body={preWarning || "o 없음"}
                        />
                      </>
                    )}

                    {Array.isArray(data.periods) && data.periods.length > 0 && (
                      <ul className="mt-2 space-y-1.5 border-t border-[var(--outline)] pt-2.5">
                        {(data.periods as Array<Record<string, unknown>>)
                          .slice(0, 8)
                          .map((p, i) => {
                            const when =
                              p.announceTime != null ? String(p.announceTime) : "";
                            const wf = p.wf != null ? String(p.wf) : "—";
                            const ta =
                              p.ta != null && String(p.ta) ? String(p.ta) : "";
                            const rn =
                              p.rnSt != null && String(p.rnSt) ? String(p.rnSt) : "";
                            const wh =
                              p.wh != null && String(p.wh) ? String(p.wh) : "";
                            const ws =
                              p.wsIt != null && String(p.wsIt) ? String(p.wsIt) : "";
                            return (
                              <li key={i} className="text-[0.8rem] leading-relaxed">
                                {when ? (
                                  <span className="text-muted">{when} · </span>
                                ) : null}
                                <span className="text-on-surface">{wf}</span>
                                {ta ? ` · ${ta}°` : ""}
                                {rn ? ` · 강수 ${rn}%` : ""}
                                {wh ? ` · 파고 ${wh}` : ""}
                                {ws ? ` · 바람 ${ws}` : ""}
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {payload.attribution && (
        <aside className="ui-panel mt-4 p-3.5 text-[0.72rem] text-muted">
          <p className="m-0 font-bold text-mountain-deep">출처 · 저작자 표시</p>
          <p className="mt-1">
            <strong>출처: {payload.attribution.author || "기상청"}</strong>
            {payload.attribution.license ? ` · ${payload.attribution.license}` : ""}
          </p>
          {payload.attribution.notice && <p className="mt-1">{payload.attribution.notice}</p>}
          {payload.attribution.source_url && (
            <a
              href={payload.attribution.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ui-link mt-1 inline-block"
            >
              공공데이터포털
            </a>
          )}
        </aside>
      )}
    </section>
  );
}
