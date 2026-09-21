"use client";

import { useEffect, useState } from "react";

export type ChatPipelineResult = {
  weather?: boolean;
  festivals?: boolean;
  places?: boolean;
  candidateCount?: number;
  candidatePreview?: string[];
  selected?: string[];
  ordered?: string[];
};

type StageId =
  | "context"
  | "catalog"
  | "gemini"
  | "order"
  | "done";

const BUSY_STAGES: Array<{ id: StageId; label: string; detail: string }> = [
  {
    id: "context",
    label: "맥락 수집",
    detail: "날씨 · 축제 · 출발/도착 검색",
  },
  {
    id: "catalog",
    label: "한산 후보 좁히기",
    detail: "동기화 명소 카탈로그 · 인접 권역만",
  },
  {
    id: "gemini",
    label: "Gemini 선정",
    detail: "후보 중 한산 스팟 고르기",
  },
  {
    id: "order",
    label: "동선 정렬",
    detail: "가까운 순 · 인접 시·군 규칙",
  },
];

function stageIndexForElapsed(ms: number) {
  if (ms < 700) return 0;
  if (ms < 1600) return 1;
  if (ms < 3200) return 2;
  return 3;
}

/** 응답 대기 중 — 처리 단계가 순차로 진행되는 타임라인 */
export function ChatPipelineBusy() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const tick = () => setActive(stageIndexForElapsed(Date.now() - started));
    tick();
    const id = window.setInterval(tick, 280);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="chat-pipeline" role="status" aria-label="코스 생성 중">
      <p className="chat-pipeline-title">처리 과정 · 생성 중</p>
      <ol className="chat-pipeline-list">
        {BUSY_STAGES.map((s, i) => {
          const state =
            i < active ? "done" : i === active ? "active" : "pending";
          return (
            <li key={s.id} className={`chat-pipeline-step is-${state}`}>
              <span className="chat-pipeline-dot" aria-hidden />
              <div className="min-w-0">
                <strong>{s.label}</strong>
                <span>{s.detail}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** 코스 생성 완료 후 — 실제 후보 수·선택·순서를 요약 */
export function ChatPipelineDone({ pipeline }: { pipeline: ChatPipelineResult }) {
  const count = pipeline.candidateCount ?? 0;
  const selected = pipeline.selected || [];
  const ordered = pipeline.ordered?.length ? pipeline.ordered : selected;
  const preview = (pipeline.candidatePreview || []).slice(0, 3);
  const ctxBits = [
    pipeline.weather ? "날씨" : null,
    pipeline.festivals ? "축제" : null,
    pipeline.places ? "장소검색" : null,
  ].filter(Boolean);

  return (
    <div className="chat-pipeline is-done" aria-label="처리 과정 요약">
      <p className="chat-pipeline-title">처리 과정 · 완료</p>
      <ol className="chat-pipeline-list">
        <li className="chat-pipeline-step is-done">
          <span className="chat-pipeline-dot" aria-hidden />
          <div className="min-w-0">
            <strong>맥락 수집</strong>
            <span>{ctxBits.length ? ctxBits.join(" · ") : "기본 컨텍스트"}</span>
          </div>
        </li>
        <li className="chat-pipeline-step is-done">
          <span className="chat-pipeline-dot" aria-hidden />
          <div className="min-w-0">
            <strong>한산 후보 {count}곳</strong>
            <span>
              {preview.length
                ? `${preview.join(" · ")}${count > preview.length ? " …" : ""}`
                : "동기화 TourAPI 카탈로그 · 내부 명소"}
            </span>
          </div>
        </li>
        <li className="chat-pipeline-step is-done">
          <span className="chat-pipeline-dot" aria-hidden />
          <div className="min-w-0">
            <strong>Gemini {selected.length}곳 선정</strong>
            <span>
              {selected.length
                ? selected.slice(0, 4).join(" → ")
                : "한산 스팟 선택"}
              {selected.length > 4 ? " …" : ""}
            </span>
          </div>
        </li>
        <li className="chat-pipeline-step is-done">
          <span className="chat-pipeline-dot" aria-hidden />
          <div className="min-w-0">
            <strong>동선 확정</strong>
            <span>
              {ordered.length
                ? ordered.map((n, i) => `${i + 1}.${n}`).join(" · ")
                : "인접 권역 순 정렬"}
            </span>
          </div>
        </li>
      </ol>
    </div>
  );
}
