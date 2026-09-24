"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PREFERENCE_OPTIONS } from "@/lib/prefs";
import { setCurrentTrip } from "@/lib/storage";
import type { TripPlan } from "@/lib/tripTypes";
import type { ChatSlots } from "@/lib/chatTypes";
import { REGION_DRAFT_EVENT } from "@/components/HomeMap";
import {
  PlaceSearchField,
  type PlacePick,
} from "@/components/PlaceSearchField";
import { TRAVEL_MODES, withTripEndpoints, type TravelMode } from "@/lib/tripTypes";
import {
  ChatPipelineBusy,
  ChatPipelineDone,
  type ChatPipelineResult,
} from "@/components/ChatPipeline";

type Msg = {
  role: "user" | "assistant";
  text: string;
  planId?: string;
  planTitle?: string;
  planScore?: number;
  planGrade?: string;
  source?: string;
  retryPrompt?: string;
  pipeline?: ChatPipelineResult;
};

const GREETING =
  "강원 어느 시·군이든 그 가는 길에 맞춰 코스를 짜 드려요. 출발·도착을 고르거나 지역 이름을 말해 주세요.";

const QUICK_ASKS = [
  "춘천에서 속초 당일",
  "원주에서 태백 1박",
  "동해·삼척 해안 코스",
];

export function HomeChat() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const askedRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [themes, setThemes] = useState<Set<string>>(() => new Set());
  const [companion, setCompanion] = useState("");
  const [companionCustom, setCompanionCustom] = useState("");
  const [companionOther, setCompanionOther] = useState(false);
  const [budget, setBudget] = useState("");
  const [slots, setSlots] = useState<ChatSlots>({});
  const [origin, setOrigin] = useState<PlacePick | null>(null);
  const [destination, setDestination] = useState<PlacePick | null>(null);
  const [mode, setMode] = useState<TravelMode>("car");
  const [duration, setDuration] = useState("당일");
  const [lastPlan, setLastPlan] = useState<TripPlan | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  function prefsNote() {
    const parts: string[] = [];
    for (const t of PREFERENCE_OPTIONS.themes) {
      if (themes.has(t.id)) parts.push(t.label);
    }
    if (companionOther) {
      const custom = companionCustom.trim();
      if (custom) parts.push(custom);
      else parts.push("기타");
    } else if (companion) {
      parts.push(companion);
    }
    if (budget) parts.push(budget);
    return parts.join(", ");
  }

  function companionValue() {
    if (companionOther) return companionCustom.trim() || "기타";
    return companion;
  }

  async function send(prompt: string) {
    const text = prompt.trim();
    if (!text || busy) return;
    setInput("");
    const nextMessages: Msg[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setBusy(true);
    try {
      const prefsStructured = {
        themes: [...themes],
        companion: companionValue(),
        budget,
      };
      const mergedSlots: ChatSlots = {
        ...slots,
        themes: prefsStructured.themes.length
          ? PREFERENCE_OPTIONS.themes
              .filter((t) => themes.has(t.id))
              .map((t) => t.label)
          : slots.themes,
        companion: companionValue() || slots.companion,
        budget: budget || slots.budget,
        origin: origin?.name || slots.origin,
        destination: destination?.name || slots.destination,
        duration,
        mode,
      };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          prefs: prefsNote(),
          prefsStructured,
          history: nextMessages
            .filter((m) => m.text !== GREETING)
            .slice(0, -1)
            .slice(-10)
            .map((m) => ({ role: m.role, text: m.text })),
          slots: mergedSlots,
          originName: origin?.name || "",
          destinationName: destination?.name || "",
          originLat: origin?.lat,
          originLng: origin?.lng,
          destinationLat: destination?.lat,
          destinationLng: destination?.lng,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);

      if (data.slots && typeof data.slots === "object") {
        setSlots((prev) => ({ ...prev, ...data.slots }));
        const nextMode = String(data.slots.mode || "");
        if (nextMode === "car" || nextMode === "walk" || nextMode === "bicycle") {
          setMode(nextMode);
        }
      }

      let plan = data.plan as TripPlan | undefined;
      if (plan?.id) {
        plan = withTripEndpoints(plan, {
          mode,
          origin: origin
            ? { name: origin.name, lat: origin.lat, lng: origin.lng }
            : null,
          destination: destination
            ? {
                name: destination.name,
                lat: destination.lat,
                lng: destination.lng,
              }
            : null,
        });
        setCurrentTrip(plan);
        setLastPlan(plan);
      }

      const apiPipeline =
        data.pipeline && typeof data.pipeline === "object"
          ? (data.pipeline as ChatPipelineResult)
          : undefined;
      const stopNames =
        plan?.steps?.map((s) => s.spot.name).filter(Boolean) || [];
      const pipeline: ChatPipelineResult | undefined = plan?.id
        ? {
            weather: apiPipeline?.weather,
            festivals: apiPipeline?.festivals,
            places: apiPipeline?.places,
            candidateCount:
              apiPipeline?.candidateCount ??
              Math.max(stopNames.length, 8),
            candidatePreview: apiPipeline?.candidatePreview,
            selected:
              apiPipeline?.selected?.length
                ? apiPipeline.selected
                : stopNames,
            ordered:
              apiPipeline?.ordered?.length
                ? apiPipeline.ordered
                : stopNames,
          }
        : undefined;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: String(data.reply || "응답이 비어 있어요."),
          planId: plan?.id,
          planTitle: plan?.title,
          planScore: plan?.dispersion?.score,
          planGrade: plan?.dispersion?.grade,
          source: data.model || data.source,
          pipeline,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `지금은 연결에 문제가 있어요.\n${msg}`,
          retryPrompt: text,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    const ask = searchParams.get("ask");
    if (!ask || askedRef.current === ask) return;
    askedRef.current = ask;
    router.replace("/", { scroll: false });
    void sendRef.current(ask);
  }, [searchParams, router]);

  useEffect(() => {
    function onDraft(e: Event) {
      const detail = (e as CustomEvent<{ draft?: string; autoSend?: boolean }>).detail;
      const draft = detail?.draft?.trim();
      if (!draft) return;
      if (detail?.autoSend) {
        void sendRef.current(draft);
        return;
      }
      setInput(draft);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(draft.length, draft.length);
      });
    }
    window.addEventListener(REGION_DRAFT_EVENT, onDraft);
    return () => window.removeEventListener(REGION_DRAFT_EVENT, onDraft);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function chipClass(on: boolean, tone: "sea" | "mountain" = "sea") {
    const onCls =
      tone === "sea" ? "bg-sea text-white border-sea" : "bg-mountain text-white border-mountain";
    return `rounded-md border px-0 py-1.5 text-center text-[0.72rem] font-semibold transition ${
      on
        ? onCls
        : "border-[var(--outline)] bg-white text-muted hover:border-sea/35 hover:text-on-surface"
    }`;
  }

  const slotLabel = [
    origin?.name ? `출 ${origin.name}` : slots.origin ? `출 ${slots.origin}` : "",
    destination?.name
      ? `도 ${destination.name}`
      : slots.destination
        ? `도 ${slots.destination}`
        : "",
    mode === "walk" ? "도보" : mode === "bicycle" ? "자전거" : "자동차",
    slots.startDate || slots.endDate
      ? `${slots.startDate || "?"}${slots.endDate && slots.endDate !== slots.startDate ? `~${slots.endDate}` : ""}`
      : "",
    slots.duration,
    slots.regions?.join("·"),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="ui-panel flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-[var(--outline)] px-3.5 py-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/mascot-icon.png"
          alt=""
          className="h-7 w-7 rounded-[0.45rem] object-contain"
        />
        <div className="min-w-0 flex-1">
          <strong className="block text-[0.88rem] font-semibold tracking-tight text-mountain-deep">
            온이
          </strong>
          <span className="text-[0.68rem] text-muted">
            {slotLabel ? slotLabel : "동선 · 취향을 맞춘 뒤 말해 주세요"}
          </span>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((m, i) => (
          <div key={`${m.role}-${i}`} className="animate-[ui-fade-up_0.28s_var(--ease)_both]">
            {m.role === "assistant" && m.pipeline ? (
              <ChatPipelineDone pipeline={m.pipeline} />
            ) : null}
            <div
              className={
                m.role === "user"
                  ? "ml-auto max-w-[88%] rounded-[var(--radius)] rounded-br-sm bg-sea px-3 py-2 text-[0.8125rem] leading-relaxed text-white"
                  : "mt-1.5 max-w-[92%] whitespace-pre-wrap rounded-[var(--radius)] rounded-bl-sm border border-[var(--outline)] bg-white px-3 py-2 text-[0.8125rem] leading-relaxed text-on-surface"
              }
            >
              {m.text}
            </div>
            {m.role === "assistant" && i === 0 && messages.length === 1 && !busy ? (
              <div className="chat-quick-row">
                {QUICK_ASKS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="chat-quick-chip"
                    onClick={() => void send(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : null}
            {m.planId && (
              <div className="plan-mini-card max-w-[92%]">
                <p className="m-0 text-[0.65rem] font-bold tracking-wide text-sea">
                  실시간 코스
                  {m.planScore != null
                    ? ` · 분산 ${m.planScore}·${m.planGrade || ""}`
                    : ""}
                </p>
                <strong className="mt-0.5 block text-[0.85rem] text-mountain-deep">
                  {m.planTitle || "맞춤 일정"}
                </strong>
                <p className="mt-1.5 m-0 text-[0.68rem] leading-snug text-muted">
                  지도에서 경유를 다듬고 찜하면 여권 스탬프가 찍힙니다.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => router.push("/planner")}
                    className="ui-btn ui-btn-primary !min-h-8 !px-3 !text-[0.72rem]"
                  >
                    지도에서 다듬기
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/passport")}
                    className="rounded-lg border border-[var(--outline)] bg-white px-2.5 py-1.5 text-[0.7rem] font-semibold text-muted"
                  >
                    여권
                  </button>
                </div>
              </div>
            )}
            {m.retryPrompt && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void send(m.retryPrompt!)}
                className="mt-1.5 rounded-lg border border-[var(--outline)] bg-white px-3 py-1.5 text-[0.72rem] font-semibold text-sea"
              >
                다시 시도
              </button>
            )}
          </div>
        ))}
        {busy ? (
          <div className="sticky bottom-0 z-[1] bg-[linear-gradient(180deg,transparent,var(--surface)_18%)] pt-2 pb-1">
            <ChatPipelineBusy />
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <footer className="relative z-10 shrink-0 overflow-y-auto border-t border-[var(--outline)] bg-white/90 px-3 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-2 max-h-[min(52dvh,28rem)] sm:max-h-none">
        <div className="mb-2 space-y-1.5 rounded-[var(--radius-sm)] border border-[var(--outline)] bg-[var(--surface)] px-2 py-2">
          <div className="grid grid-cols-2 gap-1.5">
            <PlaceSearchField
              label="출발지"
              value={origin}
              onChange={setOrigin}
              placeholder="서울역, 수원…"
            />
            <PlaceSearchField
              label="도착지"
              value={destination}
              onChange={setDestination}
              placeholder="강릉, 또는 서울"
            />
          </div>
          <div>
            <p className="mb-1 text-[0.62rem] font-semibold tracking-wide text-muted">
              이동수단
            </p>
            <div className="grid grid-cols-3 gap-1">
              {TRAVEL_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={chipClass(mode === m.id, "sea")}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[0.62rem] font-semibold tracking-wide text-muted">
              일수 · 출발과 도착이 가까우면 이 일정으로 강원을 다녀옵니다
            </p>
            <div className="grid grid-cols-3 gap-1">
              {(["당일", "1박", "2박"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={duration === item}
                  onClick={() => setDuration(item)}
                  className={chipClass(duration === item, "mountain")}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-expanded={prefsOpen}
            onClick={() => setPrefsOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--outline)] bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-mountain-deep transition hover:border-sea/40 hover:bg-sea-mist/50"
          >
            <span aria-hidden>{prefsOpen ? "▴" : "▾"}</span>
            취향
            {prefsNote() ? (
              <span className="max-w-[7rem] truncate font-medium text-muted">
                · {prefsNote()}
              </span>
            ) : null}
          </button>
          {lastPlan && (
            <button
              type="button"
              onClick={() => router.push("/planner")}
              className="ml-auto text-[0.7rem] font-medium text-sea"
            >
              일정
            </button>
          )}
        </div>

        {prefsOpen && (
          <div className="mb-2 space-y-2.5 rounded-[var(--radius-sm)] border border-[var(--outline)] bg-[var(--surface)] px-2.5 py-2.5">
            <div>
              <p className="mb-1.5 text-[0.65rem] font-semibold tracking-wide text-muted">테마</p>
              <div className="grid grid-cols-3 gap-1.5">
                {PREFERENCE_OPTIONS.themes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={themes.has(t.id)}
                    onClick={() => {
                      setThemes((prev) => {
                        const next = new Set(prev);
                        if (next.has(t.id)) next.delete(t.id);
                        else next.add(t.id);
                        return next;
                      });
                    }}
                    className={chipClass(themes.has(t.id), "sea")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[0.65rem] font-semibold tracking-wide text-muted">동행</p>
              <div className="grid grid-cols-5 gap-1.5">
                {PREFERENCE_OPTIONS.companions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={!companionOther && companion === c.label}
                    onClick={() => {
                      setCompanionOther(false);
                      setCompanion((v) => (v === c.label ? "" : c.label));
                    }}
                    className={chipClass(!companionOther && companion === c.label, "mountain")}
                  >
                    {c.label}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={companionOther}
                  onClick={() => {
                    setCompanion("");
                    setCompanionOther((v) => !v);
                  }}
                  className={chipClass(companionOther, "mountain")}
                >
                  기타
                </button>
              </div>
              {companionOther && (
                <input
                  value={companionCustom}
                  onChange={(e) => setCompanionCustom(e.target.value)}
                  maxLength={20}
                  placeholder="동행 직접 입력"
                  className="ui-field mt-1.5 !py-1.5 text-[0.75rem]"
                />
              )}
            </div>
            <div>
              <p className="mb-1.5 text-[0.65rem] font-semibold tracking-wide text-muted">예산</p>
              <div className="grid grid-cols-3 gap-1.5">
                {PREFERENCE_OPTIONS.budgets.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    aria-pressed={budget === b.label}
                    onClick={() => setBudget((v) => (v === b.label ? "" : b.label))}
                    className={chipClass(budget === b.label, "mountain")}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={onSubmit}
          aria-busy={busy}
          className="flex items-end gap-2 border border-[var(--outline)] bg-white px-2.5 py-1.5 focus-within:border-sea/40"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="예: 정선 주말 당일"
            className="max-h-28 min-h-6 flex-1 resize-none border-0 bg-transparent py-1 text-[0.8125rem] outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="전송"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-sea text-white disabled:opacity-40"
          >
            ↑
          </button>
        </form>
      </footer>
    </section>
  );
}
