import { NextRequest, NextResponse } from "next/server";
import { generateLiveTripPlan, hasGeminiKey } from "@/lib/gemini";
import { geocodePlace, suggestStopsAlongDrive } from "@/lib/routeStops";
import type { TravelMode } from "@/lib/tripTypes";
import { prefsLabelFromBody } from "@/lib/prefs";
import {
  buildPlanPrompt,
  festivalsForConsult,
  formatFestivalNote,
  mergeSlots,
  weatherNoteForConsult,
  type ChatSlots,
} from "@/lib/chatConsult";

export const runtime = "nodejs";

function getKakaoRestKey() {
  return (process.env.KAKAO_REST_KEY || "").trim();
}

async function kakaoPlaceNote(slots: ChatSlots): Promise<string> {
  const key = getKakaoRestKey();
  if (!key) return "";
  async function search(q: string) {
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
      }>;
      return docs
        .map((d, i) => `${i + 1}. ${d.place_name} (${d.address_name})`)
        .join("\n");
    } catch {
      return "";
    }
  }
  const chunks: string[] = [];
  if (slots.origin) {
    const h = await search(slots.origin);
    if (h) chunks.push(`출발 "${slots.origin}":\n${h}`);
  }
  if (slots.destination) {
    const h = await search(slots.destination);
    if (h) chunks.push(`도착 "${slots.destination}":\n${h}`);
  }
  return chunks.join("\n");
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

    const body = (await req.json()) as Record<string, unknown>;
    const prompt = String(body?.prompt || "").trim();
    const prefs = prefsLabelFromBody(body);
    if (!prompt) {
      return NextResponse.json({ error: "프롬프트가 비어 있습니다." }, { status: 400 });
    }
    if (prompt.length > 4000) {
      return NextResponse.json({ error: "질문이 너무 깁니다." }, { status: 400 });
    }

    let slots = mergeSlots({}, (body?.slots || {}) as ChatSlots);
    const bodyOrigin = String(body?.originName || "").trim();
    const bodyDest = String(body?.destinationName || "").trim();
    if (bodyOrigin) slots = mergeSlots(slots, { origin: bodyOrigin });
    if (bodyDest) slots = mergeSlots(slots, { destination: bodyDest });
    const bodyMode = String(body?.mode || "").trim();
    if (bodyMode === "car" || bodyMode === "walk" || bodyMode === "bicycle") {
      slots = mergeSlots(slots, { mode: bodyMode });
    }

    const [weather, festivalNote, placeNote] = await Promise.all([
      weatherNoteForConsult(slots, prompt),
      Promise.resolve(formatFestivalNote(festivalsForConsult(slots))),
      kakaoPlaceNote(slots),
    ]);

    const planPrompt = buildPlanPrompt(prompt, slots);
    const originLat = Number(body?.originLat);
    const originLng = Number(body?.originLng);
    const destLat = Number(body?.destinationLat);
    const destLng = Number(body?.destinationLng);
    const namedOrigin = slots.origin || String(body?.originName || "");
    const namedDest = slots.destination || String(body?.destinationName || "");
    const originPoint = Number.isFinite(originLat) && Number.isFinite(originLng)
      ? { name: namedOrigin || "출발", lat: originLat, lng: originLng }
      : namedOrigin
        ? await geocodePlace(namedOrigin)
        : null;
    const destPoint = Number.isFinite(destLat) && Number.isFinite(destLng)
      ? { name: namedDest || "도착", lat: destLat, lng: destLng }
      : namedDest
        ? await geocodePlace(namedDest)
        : null;
    let corridorSpots: Awaited<ReturnType<typeof suggestStopsAlongDrive>>["picks"][number]["spot"][] = [];
    if (originPoint || destPoint) {
      const along = await suggestStopsAlongDrive({
        origin: originPoint,
        destination: destPoint,
        mode: (slots.mode || "car") as TravelMode,
        durationHint: slots.duration || prompt,
        text: `${prompt}\n${namedOrigin}\n${namedDest}`,
      });
      corridorSpots = along.picks.map((p) => p.spot);
    }
    const live = await generateLiveTripPlan(planPrompt, prefs, {
      weatherNote: weather,
      festivalNote,
      placeNote,
      durationHint: slots.duration,
      corridorSpots,
      requireCorridor: Boolean(originPoint || destPoint),
    });

    if (slots.mode === "car" || slots.mode === "walk" || slots.mode === "bicycle") {
      live.plan.mode = slots.mode;
    }

    return NextResponse.json({
      plan: live.plan,
      reply: live.reply,
      model: live.model,
      live: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "코스 생성 실패";
    const status = /API_KEY|설정되지 않/.test(message) ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
