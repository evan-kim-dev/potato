import { spotsMatchingPrompt, type Spot } from "@/lib/data";
import type { ChatSlots, ChatTurnMessage } from "@/lib/chatConsult";
import { mergeSlots } from "@/lib/chatConsult";
import {
  candidateSpotsForPlan,
  inferDurationLabel,
  orderPlanStepsByProximity,
  resolveSpotsFromSelection,
} from "@/lib/tripPlan";
import type { PlanStep, TripPlan } from "@/lib/tripTypes";
import { withDispersionSummary } from "@/lib/impactScore";

/** 넣어 둔 GOOGLE_API_KEY로 가능한 최신 모델부터 시도 */
const MODEL_FALLBACK = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-3.5-flash",
] as const;

export type GeminiChatResult = {
  reply: string;
  model: string;
};

export type GeminiContext = {
  prefs?: string;
  weatherNote?: string;
  placeNote?: string;
  festivalNote?: string;
  spotExtra?: Spot[];
  slots?: ChatSlots;
  history?: ChatTurnMessage[];
  today?: string;
};

export type ConsultTurnResult = GeminiChatResult & {
  action: "ask" | "plan" | "chat";
  slots: ChatSlots;
  followUps: string[];
};

function getApiKey() {
  return (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").trim();
}

export function hasGeminiKey() {
  return Boolean(getApiKey());
}

function formatSpotContext(spots: Spot[]) {
  if (!spots.length) return "";
  const lines = spots.map(
    (s, i) =>
      `${i + 1}. ${s.name} (${s.region}, ${s.theme}) — ${s.description}` +
      (s.tip ? ` / tip: ${s.tip}` : "") +
      (s.hours ? ` / 운영: ${s.hours}` : "")
  );
  return [
    "# 참고 관광지 (이 목록을 우선 활용)",
    ...lines,
    "목록에 없는 장소는 단정하지 말고, 목록 위주로 코스를 제안하세요.",
  ].join("\n");
}

async function callGemini(
  system: string,
  user: string,
  opts?: {
    temperature?: number;
    maxOutputTokens?: number;
    json?: boolean;
    history?: ChatTurnMessage[];
  }
): Promise<GeminiChatResult> {
  const key = getApiKey();
  if (!key) {
    throw new Error("GOOGLE_API_KEY 가 서버에 설정되지 않았습니다.");
  }

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const m of opts?.history || []) {
    const text = String(m.text || "").trim();
    if (!text) continue;
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text }],
    });
  }
  contents.push({ role: "user", parts: [{ text: user }] });

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature: opts?.temperature ?? 0.55,
      maxOutputTokens: opts?.maxOutputTokens ?? 2048,
      ...(opts?.json ? { responseMimeType: "application/json" } : {}),
    },
  };

  let lastError = "Gemini 호출 실패";
  for (const model of MODEL_FALLBACK) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
      `?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.json())?.error?.message || "";
      } catch {
        /* ignore */
      }
      lastError = `Gemini ${model} HTTP ${res.status}${detail ? `: ${detail}` : ""}`;
      if ([400, 401, 403].includes(res.status)) continue;
      continue;
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
      .map((p: { text: string }) => p.text)
      .join("")
      .trim();
    if (!text) {
      lastError = `Gemini ${model} 응답이 비어 있습니다.`;
      continue;
    }
    return { reply: text, model };
  }
  throw new Error(lastError);
}

const ONI_SYSTEM_CORE = [
  "당신은 강원도 여행 AI 가이드 '온이'입니다. 친근하고 짧고 실용적으로, 한국어로 답하세요.",
  "핵심 미션: 인구감소·한산 권역(영월·정선·태백·양구·인제·화천·철원·고성 등) 활성화.",
  "유명 해안 핫플만 추천하지 말고, 숨은 명소·저밀도 동선·로컬 혜택(관광주민증·강원페이)을 우선하세요.",
  "사용자가 강릉·속초·해수욕장을 말해도 짧게 인정한 뒤 인근 한산 권역 분산을 반드시 제안하세요.",
  "동선은 인접 시·군만 이어가세요. 철원↔태백, 고성↔영월처럼 도를 가로지르는 점프는 금지.",
  "코스는 관광객 분산·저밀도(ESG) 가치가 드러나게 짜세요. 한산 비중과 인접 이동을 의식하세요.",
  "확실하지 않은 영업시간·요금은 단정하지 마세요.",
].join("\n");

type ConsultPayload = {
  reply?: string;
  action?: "ask" | "plan" | "chat";
  slots?: ChatSlots;
  followUps?: string[];
};

/**
 * 상담 턴: 일정·권역·취향을 모으고, 축제/날씨를 반영해 추가질문 또는 코스 생성 신호.
 */
export async function generateConsultTurn(
  prompt: string,
  ctx: GeminiContext = {}
): Promise<ConsultTurnResult> {
  const related = [
    ...(ctx.spotExtra || []),
    ...spotsMatchingPrompt(
      [prompt, ...(ctx.slots?.regions || []), ...(ctx.slots?.themes || [])].join(" "),
      10
    ),
  ].filter(
    (s, i, arr) => arr.findIndex((x) => x.name === s.name && x.region === s.region) === i
  );

  const known = ctx.slots || {};
  const system = [
    ONI_SYSTEM_CORE,
    "역할: 빠른 여행 코치. 고정 템플릿·목업 코스 금지. 매번 요청에 맞게 새로 판단하세요.",
    "여행 의도(추천/코스/일정/지역명)가 보이면 웬만하면 action=plan. 부족한 값은 지어내지 말고 slots에만 넣은 뒤 코스 생성에 맡기세요.",
    "특정 시·군(정선·영월 등)을 기본값으로 밀어넣지 마세요. 사용자가 말한 것만 regions에.",
    "날짜·기간이 문장에 있으면 slots에 환산. 없으면 비워 두세요.",
    "출발지·도착지가 있으면 slots.origin / slots.destination. 이동수단(자동차/도보/자전거)이 있으면 slots.mode에 car|walk|bicycle.",
    "날짜·축제·날씨 참고가 있으면 반영하세요.",
    "action=ask는 목적지가 완전 모호할 때만, 질문 한 개.",
    "단순 인사·잡담만이면 action=chat.",
    "reply는 짧고 실용적으로. followUps는 항상 [].",
    "slots 날짜는 YYYY-MM-DD.",
    "JSON만 출력. 스키마:",
    '{"reply":string,"action":"ask"|"plan"|"chat","slots":{"startDate":string?,"endDate":string?,"duration":string?,"regions":string[],"themes":string[],"companion":string?,"budget":string?,"origin":string?,"destination":string?,"mode":"car"|"walk"|"bicycle"?,"readyForPlan":boolean},"followUps":[]}',
    `오늘(Asia/Seoul): ${ctx.today || new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })}`,
    ctx.prefs ? `사용자 취향 칩: ${ctx.prefs}` : "",
    known && Object.keys(known).length
      ? `이미 수집된 슬롯(유지·보완, 없는 건 만들지 말 것): ${JSON.stringify(known)}`
      : "수집된 슬롯 없음.",
    ctx.weatherNote ? `날씨 참고:\n${ctx.weatherNote}` : "",
    ctx.festivalNote ? `기간·권역 관련 축제/행사:\n${ctx.festivalNote}` : "",
    ctx.placeNote ? `장소 검색 참고:\n${ctx.placeNote}` : "",
    formatSpotContext(related.slice(0, 10)),
  ]
    .filter(Boolean)
    .join("\n\n");

  const history = (ctx.history || []).slice(-12);
  const raw = await callGemini(system, prompt, {
    temperature: 0.45,
    maxOutputTokens: 1600,
    json: true,
    history,
  });

  let parsed: ConsultPayload = {};
  try {
    parsed = JSON.parse(raw.reply) as ConsultPayload;
  } catch {
    const m = raw.reply.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]) as ConsultPayload;
      } catch {
        parsed = {};
      }
    }
  }

  const slots = mergeSlots(known, parsed.slots || {});
  const action =
    parsed.action === "plan" || parsed.action === "ask" || parsed.action === "chat"
      ? parsed.action
      : parsed.reply
        ? "chat"
        : "ask";

  const followUps: string[] = [];

  const reply =
    parsed.reply?.trim() ||
    (action === "ask"
      ? "어디로 가고 싶으세요? 한 곳만 말해 주셔도 바로 짜 드릴게요."
      : raw.reply);

  return { reply, model: raw.model, action, slots, followUps };
}

/** 자유 대화 — 취향·날씨·장소 컨텍스트를 최대한 활용 */
export async function generateTravelReply(
  prompt: string,
  ctx: GeminiContext = {}
): Promise<GeminiChatResult> {
  const related = [
    ...(ctx.spotExtra || []),
    ...spotsMatchingPrompt(prompt, 10),
  ].filter(
    (s, i, arr) => arr.findIndex((x) => x.name === s.name && x.region === s.region) === i
  );

  const system = [
    ONI_SYSTEM_CORE,
    ctx.prefs ? `사용자 취향: ${ctx.prefs}` : "",
    ctx.weatherNote ? `현재 날씨 참고:\n${ctx.weatherNote}` : "",
    ctx.festivalNote ? `축제/행사 참고:\n${ctx.festivalNote}` : "",
    ctx.placeNote ? `출발/장소 검색 참고:\n${ctx.placeNote}` : "",
    formatSpotContext(related.slice(0, 12)),
  ]
    .filter(Boolean)
    .join("\n\n");

  return callGemini(system, prompt, {
    temperature: 0.55,
    maxOutputTokens: 1800,
    history: ctx.history,
  });
}

type LivePlanPayload = {
  title?: string;
  summary?: string;
  duration?: string;
  reply?: string;
  steps?: Array<{
    name?: string;
    region?: string;
    day?: number;
    stay?: number;
    why?: string;
    move_to_next?: string;
  }>;
};

/**
 * 카탈로그 후보를 주고 Gemini가 스팟 선택·순서·일차·이유를 실시간 생성.
 * 로컬 템플릿 코스 없이 AI 출력만으로 TripPlan을 만듭니다.
 */
export type PlanPipelineMeta = {
  candidateCount: number;
  candidatePreview: string[];
  selected: string[];
  ordered: string[];
};

export async function generateLiveTripPlan(
  prompt: string,
  prefs = "",
  extra?: {
    weatherNote?: string;
    festivalNote?: string;
    placeNote?: string;
    durationHint?: string;
    /** 출발→도착 경로 적합 모델이 고른 후보. 있으면 이 목록·순서를 유지 */
    corridorSpots?: Spot[];
    /** 출발 또는 도착이 있으면, 경로 밖 기본 클러스터로 되돌리지 않음 */
    requireCorridor?: boolean;
  }
): Promise<{
  plan: TripPlan;
  reply: string;
  model: string;
  pipeline: PlanPipelineMeta;
}> {
  const durationHint = extra?.durationHint || inferDurationLabel(prompt) || "당일 코스";
  const alongRoute = (extra?.corridorSpots || []).filter(
    (s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)
  );
  const catalog = extra?.requireCorridor
    ? alongRoute
    : alongRoute.length >= 2
      ? alongRoute
      : candidateSpotsForPlan(prompt, prefs, {
          placeNote: extra?.placeNote,
          durationHint,
        });
  if (!catalog.length) {
    throw new Error(
      extra?.requireCorridor
        ? "이 출발·도착 경로 위에 넣을 만한 명소가 없습니다. 목적지를 강원 쪽으로 잡아 보세요."
        : "매칭되는 관광지 후보가 없습니다. 권역·키워드를 바꿔 보세요."
    );
  }

  const spotLines = catalog
    .map(
      (s, i) =>
        `${i + 1}. ${s.name} | ${s.region} | ${s.theme} | ${s.description.slice(0, 80)}`
    )
    .join("\n");

  const system = [
    ONI_SYSTEM_CORE,
    "역할: 아래 후보 목록에서만 스팟을 골라 실시간 여행 코스 JSON을 만드세요. 목록에 없는 장소명 금지.",
    "로컬 템플릿·고정 코스를 쓰지 말고, 요청·날씨·축제·출발/도착에 맞게 매번 새로 고르세요.",
    "한산·인구감소 권역 스팟을 우선. 해안 핫플만으로 채우지 마세요.",
    alongRoute.length >= 1
      ? "동선 규칙(필수): 후보는 경로 적합 모델이 도로 우회가 적은 순으로 고른 목록이다. 순서를 유지하고 목록 밖 장소를 넣지 마세요."
      : "동선 규칙(필수): 같은 시·군 또는 서로 인접한 시·군만 연속 배치. 멀리 떨어진 권역을 번갈아 넣지 마세요.",
    "예: 정선→영월→태백(OK). 정선→철원→삼척(금지). 하루 동선은 좁은 권역 안에서 가까운 순.",
    "steps 순서는 실제 이동 경로(가까운 곳부터). move_to_next에 짧은 이동 안내.",
    "당일 3~5곳, 1박2일 5~7곳, 2박3일 6~8곳. day는 1부터. 일차가 바뀌어도 전날 마지막과 가까운 권역에서 이어가세요.",
    "JSON만 출력. 스키마:",
    '{"title":string,"summary":string,"duration":string,"reply":string,"steps":[{"name":string,"region":string,"day":number,"stay":number,"why":string,"move_to_next":string}]}',
    "title 12자 내외. summary 한 줄. reply는 사용자에게 보여줄 소개 4~8줄(불릿 가능). stay 40~120.",
    "reply에 가정한 일정·날씨·축제·출발/도착·권역 묶음 반영 한 줄 포함.",
    prefs ? `취향: ${prefs}` : "",
    extra?.weatherNote ? `날씨:\n${extra.weatherNote}` : "",
    extra?.festivalNote ? `축제/행사:\n${extra.festivalNote}` : "",
    extra?.placeNote ? `출발/도착 참고:\n${extra.placeNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const user = [
    `요청: ${prompt}`,
    `기간 힌트: ${durationHint}`,
    "후보 스팟(이미 인접 권역으로 좁힌 목록 — 이 안에서만 고르세요):",
    spotLines,
  ].join("\n");

  const raw = await callGemini(system, user, {
    temperature: 0.55,
    maxOutputTokens: 2800,
    json: true,
  });

  let parsed: LivePlanPayload = {};
  try {
    parsed = JSON.parse(raw.reply) as LivePlanPayload;
  } catch {
    const m = raw.reply.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]) as LivePlanPayload;
      } catch {
        parsed = {};
      }
    }
  }

  const resolved = resolveSpotsFromSelection(parsed.steps || [], catalog);
  if (resolved.length < 2) {
    // 후보에서 상위 스팟으로 최소 코스 구성 후 재시도 메시지
    const fallback = catalog.slice(0, Math.min(4, catalog.length));
    if (fallback.length < 2) {
      throw new Error(
        "AI가 유효한 스팟을 고르지 못했습니다. 권역(예: 정선, 영월)을 넣어 다시 시도해 주세요."
      );
    }
    parsed = {
      ...parsed,
      steps: fallback.map((s, i) => ({
        name: s.name,
        region: s.region,
        day: 1,
        stay: 70,
        why: `${s.region} · ${s.theme || "여행"}`,
        move_to_next: i < fallback.length - 1 ? `다음: ${fallback[i + 1].name}` : "",
      })),
    };
  }

  const finalResolved =
    resolved.length >= 2
      ? resolved
      : resolveSpotsFromSelection(parsed.steps || [], catalog);

  const metaByName = new Map(
    (parsed.steps || []).map((s) => [
      `${(s.name || "").replace(/\s/g, "")}|${(s.region || "").replace(/\s/g, "")}`,
      s,
    ])
  );

  const duration = parsed.duration?.trim() || durationHint;
  const rawSteps: PlanStep[] = finalResolved.map((spot, i) => {
    const meta =
      metaByName.get(`${spot.name.replace(/\s/g, "")}|${spot.region.replace(/\s/g, "")}`) ||
      (parsed.steps || []).find(
        (s) => (s.name || "").replace(/\s/g, "") === spot.name.replace(/\s/g, "")
      );
    const day = Math.max(1, Math.min(3, Number(meta?.day) || 1));
    const stay = Number(meta?.stay);
    return {
      order: i + 1,
      day,
      stay: stay >= 30 && stay <= 180 ? stay : 70,
      why: meta?.why?.trim() || `${spot.region} · ${spot.theme || "여행"}`,
      move_to_next: meta?.move_to_next?.trim() || undefined,
      kind: "stop" as const,
      spot,
    };
  });
  const steps =
    alongRoute.length >= 1
      ? [...rawSteps].sort((a, b) => {
          const ia = alongRoute.findIndex((s) => s.name === a.spot.name);
          const ib = alongRoute.findIndex((s) => s.name === b.spot.name);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        }).map((s, i) => ({ ...s, order: i + 1 }))
      : orderPlanStepsByProximity(rawSteps);

  const plan: TripPlan = withDispersionSummary({
    id: `trip-${Date.now()}`,
    query: prefs ? `${prompt}\n(취향: ${prefs})` : prompt,
    savedAt: new Date().toISOString(),
    title: parsed.title?.trim() || "실시간 맞춤 코스",
    summary: parsed.summary?.trim() || `${duration} · ${steps.length}곳 · AI 실시간`,
    duration,
    source: raw.model,
    steps,
    stopNames: steps.map((s) => s.spot.name),
  });

  const reply =
    parsed.reply?.trim() ||
    `${plan.title}\n${plan.summary}\n\n` +
      plan.steps
        .map((s) => `${s.order}. ${s.spot.name} (${s.spot.region}) · ${s.stay}분\n   ${s.why}`)
        .join("\n");

  const dispersionLine = plan.dispersion
    ? `\n\n저밀도 분산 ${plan.dispersion.score}점(${plan.dispersion.grade}) · ${plan.dispersion.esgNote}`
    : "";

  const orderedNames = steps.map((s) => s.spot.name);
  const selectedNames = finalResolved.map((s) => s.name);

  return {
    plan,
    reply: parsed.reply?.trim()
      ? `${parsed.reply.trim()}${dispersionLine}`
      : `${reply}${dispersionLine}`,
    model: raw.model,
    pipeline: {
      candidateCount: catalog.length,
      candidatePreview: catalog.slice(0, 5).map((s) => `${s.name}(${s.region})`),
      selected: selectedNames,
      ordered: orderedNames,
    },
  };
}
