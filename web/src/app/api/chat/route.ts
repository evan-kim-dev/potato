import { NextRequest, NextResponse } from "next/server";
import {
  buildPlanPrompt,
  festivalsForConsult,
  formatFestivalNote,
  mergeSlots,
  slotsSummary,
  weatherNoteForConsult,
  type ChatSlots,
  type ChatTurnMessage,
} from "@/lib/chatConsult";
import {
  generateConsultTurn,
  generateLiveTripPlan,
  generateTravelReply,
  hasGeminiKey,
} from "@/lib/gemini";
import { benefitsForRegions } from "@/lib/benefits";
import { prefsLabelFromBody } from "@/lib/prefs";
import { geocodePlace, suggestStopsAlongDrive } from "@/lib/routeStops";
import type { TravelMode } from "@/lib/tripTypes";

export const runtime = "nodejs";

function getKakaoRestKey() {
  return (process.env.KAKAO_REST_KEY || "").trim();
}

async function kakaoPlaceNote(
  prompt: string,
  slots: ChatSlots
): Promise<string> {
  const key = getKakaoRestKey();
  if (!key) return "";

  async function search(q: string): Promise<string> {
    const term = q.trim();
    if (term.length < 2) return "";
    try {
      const params = new URLSearchParams({ query: term, size: "3" });
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
        { headers: { Authorization: `KakaoAK ${key}` }, next: { revalidate: 120 } }
      );
      if (!res.ok) return "";
      const data = await res.json();
      const docs = (data.documents || []) as Array<{
        place_name: string;
        address_name: string;
        category_name?: string;
      }>;
      if (!docs.length) return "";
      return docs
        .map(
          (d, i) =>
            `${i + 1}. ${d.place_name} (${d.address_name})${d.category_name ? ` · ${d.category_name}` : ""}`
        )
        .join("\n");
    } catch {
      return "";
    }
  }

  const chunks: string[] = [];
  if (slots.origin) {
    const hit = await search(slots.origin);
    if (hit) chunks.push(`출발지 "${slots.origin}" 후보:\n${hit}`);
  }
  if (slots.destination) {
    const hit = await search(slots.destination);
    if (hit) chunks.push(`도착지 "${slots.destination}" 후보:\n${hit}`);
  }
  if (!chunks.length) {
    const m = prompt.match(
      /([가-힣]{2,12}(?:역|공항|터미널|동|구|시|군|읍|면)?)/
    );
    const q = (m?.[1] || "").trim();
    const hit = await search(q);
    if (hit) chunks.push(`장소 검색:\n${hit}`);
  }
  return chunks.join("\n\n");
}

/** 현재 발화에 코스 생성 의도가 있는지 (과거 readyForPlan만으로 강제하지 않음) */
function wantsPlanNow(prompt: string) {
  return /코스|일정|여행|당일|1\s*박|2\s*박|추천|루트|동선|짜\s*줘|짜줘|계획|놀러|가볼|다시\s*짜|바꿔|수정해|재생성|만들어/.test(
    prompt
  );
}

export async function POST(req: NextRequest) {
  try {
    if (!hasGeminiKey()) {
      return NextResponse.json(
        {
          error:
            "GOOGLE_API_KEY가 없어 실시간 코스를 만들 수 없습니다. .env.local에 키를 넣어 주세요.",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const prompt = String(body?.prompt || "").trim();
    const prefs = prefsLabelFromBody(body) || String(body?.prefs || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "프롬프트가 비어 있습니다." }, { status: 400 });
    }
    if (prompt.length > 4000) {
      return NextResponse.json({ error: "질문이 너무 깁니다." }, { status: 400 });
    }

    const history = (Array.isArray(body?.history) ? body.history : [])
      .slice(-12)
      .map((m: { role?: string; text?: string }) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        text: String(m.text || "").slice(0, 2000),
      })) as ChatTurnMessage[];

    let slots = mergeSlots({}, (body?.slots || {}) as ChatSlots);
    // 이전 코스 플래그는 무시 — 이번 메시지 의도만 본다
    delete slots.readyForPlan;
    const bodyOrigin = String(body?.originName || "").trim();
    const bodyDest = String(body?.destinationName || "").trim();
    if (bodyOrigin) slots = mergeSlots(slots, { origin: bodyOrigin });
    if (bodyDest) slots = mergeSlots(slots, { destination: bodyDest });
    const bodyMode = String(body?.mode || "").trim();
    if (bodyMode === "car" || bodyMode === "walk" || bodyMode === "bicycle") {
      slots = mergeSlots(slots, { mode: bodyMode });
    }

    const [weather, place] = await Promise.all([
      weatherNoteForConsult(slots, prompt),
      kakaoPlaceNote(prompt, slots),
    ]);
    let festivalNote = formatFestivalNote(festivalsForConsult(slots));

    const consult = await generateConsultTurn(prompt, {
      prefs,
      weatherNote: weather,
      placeNote: place,
      festivalNote,
      slots,
      history,
      today: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }),
    });

    slots = mergeSlots(slots, consult.slots);
    festivalNote = formatFestivalNote(festivalsForConsult(slots));

    let action = consult.action;
    if (wantsPlanNow(prompt)) action = "plan";
    if (action === "ask" && wantsPlanNow(prompt)) action = "plan";
    // 잡담·감사는 코스 재생성하지 않음
    if (action === "plan" && !wantsPlanNow(prompt) && consult.action === "chat") {
      action = "chat";
    }
    if (action === "plan" && !wantsPlanNow(prompt) && consult.action === "ask") {
      action = "ask";
    }

    if (action === "chat") {
      const soft = await generateTravelReply(prompt, {
        prefs,
        weatherNote: weather,
        placeNote: place,
        festivalNote,
        history,
        slots,
      });
      return NextResponse.json({
        reply: soft.reply,
        action: "chat",
        slots,
        model: soft.model,
        context: {
          weather: Boolean(weather),
          festivals: Boolean(festivalNote),
          places: Boolean(place),
          slots: slotsSummary(slots),
          live: true,
        },
      });
    }

    if (action !== "plan") {
      return NextResponse.json({
        reply: consult.reply,
        action: "ask",
        slots,
        model: consult.model,
        context: {
          weather: Boolean(weather),
          festivals: Boolean(festivalNote),
          places: Boolean(place),
          slots: slotsSummary(slots),
          live: true,
        },
      });
    }

    const planPrompt = buildPlanPrompt(prompt, slots);
    const bodyOLat = Number(body?.originLat);
    const bodyOLng = Number(body?.originLng);
    const bodyDLat = Number(body?.destinationLat);
    const bodyDLng = Number(body?.destinationLng);
    const pinnedOrigin =
      slots.origin && Number.isFinite(bodyOLat) && Number.isFinite(bodyOLng)
        ? { name: slots.origin, lat: bodyOLat, lng: bodyOLng }
        : null;
    const pinnedDest =
      slots.destination && Number.isFinite(bodyDLat) && Number.isFinite(bodyDLng)
        ? { name: slots.destination, lat: bodyDLat, lng: bodyDLng }
        : null;
    const [geoOrigin, geoDest] = await Promise.all([
      pinnedOrigin ||
        (slots.origin ? geocodePlace(slots.origin) : Promise.resolve(null)),
      pinnedDest ||
        (slots.destination ? geocodePlace(slots.destination) : Promise.resolve(null)),
    ]);
    const along = await suggestStopsAlongDrive({
      origin: geoOrigin,
      destination: geoDest,
      mode: (slots.mode || "car") as TravelMode,
      durationHint: slots.duration || prompt,
      text: `${prompt}\n${slots.duration || ""}\n${(slots.themes || []).join(" ")}\n${slots.origin || ""}\n${slots.destination || ""}\n${(slots.regions || []).join(" ")}`,
    });
    const corridorSpots = along.picks.map((p) => p.spot);
    const live = await generateLiveTripPlan(planPrompt, prefs, {
      weatherNote: weather,
      festivalNote,
      placeNote: place,
      durationHint: slots.duration,
      corridorSpots,
      requireCorridor: Boolean(along.origin || along.destination),
    });
    if (along.origin) live.plan.origin = along.origin;
    if (along.destination) live.plan.destination = along.destination;

    if (slots.mode === "car" || slots.mode === "walk" || slots.mode === "bicycle") {
      live.plan.mode = slots.mode;
    }

    let reply = live.reply;
    // consult가 이미 코스 소개면 중복 prepend 생략
    if (
      consult.reply &&
      consult.action === "ask" &&
      !live.reply.includes(consult.reply.slice(0, 20))
    ) {
      reply = `${consult.reply}\n\n${live.reply}`;
    }

    const benefit = benefitsForRegions(live.plan.steps.map((s) => s.spot.region));
    if (benefit) reply += `\n\n💡 ${benefit.title}\n${benefit.body}`;
    if (live.plan.dispersion) {
      reply += `\n\n분산 ${live.plan.dispersion.score}점(${live.plan.dispersion.grade}) · 한산 ${live.plan.dispersion.quietStops}/${live.plan.dispersion.totalStops} · 인접 ${live.plan.dispersion.adjacentLegs}/${Math.max(1, live.plan.dispersion.totalLegs)}`;
    }
    reply += `\n\n일정에서 스탑을 누르면 인근 강원페이·로컬 가맹을 볼 수 있어요.`;
    if (festivalNote) reply += `\n\n기간 관련 행사\n${festivalNote}`;

    return NextResponse.json({
      reply,
      action: "plan",
      slots: { ...slots, readyForPlan: undefined },
      plan: live.plan,
      model: live.model,
      pipeline: {
        weather: Boolean(weather),
        festivals: Boolean(festivalNote),
        places: Boolean(place),
        ...live.pipeline,
      },
      context: {
        weather: Boolean(weather),
        festivals: Boolean(festivalNote),
        places: Boolean(place),
        slots: slotsSummary(slots),
        live: true,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "서버 오류";
    const status = /API_KEY|설정되지 않/.test(message) ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
