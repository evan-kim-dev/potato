import { getCities, getFestivals, type Festival } from "@/lib/data";
import { QUIET_REGIONS, normalizeRegionName } from "@/lib/prefs";
import { congestionHintForRegion } from "@/lib/impactScore";
import { fetchGangwonWeather } from "@/lib/weather";
import type { ChatSlots } from "@/lib/chatTypes";

export type { ChatSlots } from "@/lib/chatTypes";

export type ChatTurnMessage = {
  role: "user" | "assistant";
  text: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYmdDash(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseYmdCompact(s: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function overlaps(
  a0: Date,
  a1: Date,
  b0: Date,
  b1: Date
): boolean {
  return a0.getTime() <= b1.getTime() && b0.getTime() <= a1.getTime();
}

function regionMatches(place: string, hints: string[]): boolean {
  if (!hints.length) return true;
  const p = place.replace(/\s/g, "");
  return hints.some((h) => {
    const short = h.replace(/(시|군|특별자치도|도)$/, "");
    return p.includes(h) || p.includes(short) || h.includes(p.replace(/(시|군)$/, ""));
  });
}

/** 여행 기간과 겹치는 축제 (날짜 없으면 한산 권역 다가오는 행사) */
export function festivalsForConsult(slots: ChatSlots, limit = 8): Festival[] {
  const all = getFestivals();
  const start = slots.startDate ? parseYmdDash(slots.startDate) : null;
  const end = slots.endDate
    ? parseYmdDash(slots.endDate)
    : start
      ? start
      : null;
  const regionHints = [
    ...(slots.regions || []),
    ...QUIET_REGIONS.map((r) => r.replace(/(시|군)$/, "")),
  ];

  const scored = all.map((f) => {
    const fs = parseYmdCompact(f.eventStartDate || "");
    const fe = parseYmdCompact(f.eventEndDate || "") || fs;
    let score = 0;
    if (start && end && fs && fe && overlaps(start, end, fs, fe)) score += 40;
    else if (!start && fs) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const horizon = new Date(today);
      horizon.setDate(horizon.getDate() + 60);
      if (fe && fe >= today && fs <= horizon) score += 20;
    }
    if (regionMatches(f.place || "", slots.regions?.length ? slots.regions : regionHints))
      score += 25;
    else if (regionMatches(f.place || "", [...QUIET_REGIONS])) score += 10;
    if (/한산|인구|산천어|청령|아우라지|탄광|DMZ|평화/.test(`${f.title} ${f.desc || ""}`)) {
      score += 4;
    }
    return { f, score, fs };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.fs?.getTime() || 0) - (b.fs?.getTime() || 0)
  );
  return scored.filter((r) => r.score > 0).slice(0, limit).map((r) => r.f);
}

export function formatFestivalNote(festivals: Festival[]): string {
  if (!festivals.length) return "";
  return festivals
    .map(
      (f) =>
        `- ${f.title} · ${f.place} · ${f.period || `${f.eventStartDate}~${f.eventEndDate}`}`
    )
    .join("\n");
}

const COASTAL_HOT = new Set(["강릉시", "속초시", "양양군"]);

/** 기상 × 축제 × 권역유형 → 혼잡 프록시 (통신사 유동인구 MVP 대체) */
export function congestionMashupNote(
  slots: ChatSlots,
  weatherLines: string
): string {
  const quietSet = new Set<string>(QUIET_REGIONS);
  const seeds =
    slots.regions?.length
      ? slots.regions
      : slots.destination
        ? [slots.destination]
        : ["정선군", "영월군", "속초시"];
  const fests = festivalsForConsult(slots, 24);
  const lines: string[] = [];

  for (const raw of seeds.slice(0, 4)) {
    const region =
      normalizeRegionName(raw) ||
      normalizeRegionName(raw.replace(/(시|군)$/, "") + "군") ||
      normalizeRegionName(raw.replace(/(시|군)$/, "") + "시");
    if (!region) continue;
    const short = region.replace(/(시|군)$/, "");
    const festCount = fests.filter((f) =>
      regionMatches(f.place || "", [region, short])
    ).length;
    const wxMatch = weatherLines
      .split("\n")
      .find((l) => l.includes(short) || l.includes(region));
    const hint = congestionHintForRegion({
      region,
      isQuiet: quietSet.has(region),
      isCoastalHot: COASTAL_HOT.has(region),
      festivalCount: festCount,
      weatherLabel: wxMatch || "",
    });
    lines.push(
      `${short}: ${hint.label}${hint.reasons.length ? ` · ${hint.reasons.join(", ")}` : ""}`
    );
  }

  if (!lines.length) return "";
  return `혼잡 프록시(기상×축제×권역):\n${lines.join("\n")}`;
}

/** 슬롯·프롬프트에 맞는 날씨 요약 */
export async function weatherNoteForConsult(
  slots: ChatSlots,
  prompt: string
): Promise<string> {
  try {
    const cities = getCities();
    const cards = await fetchGangwonWeather(cities);
    const pool = [
      "영월",
      "정선",
      "태백",
      "양구",
      "인제",
      "화천",
      "철원",
      "고성",
      "평창",
      "홍천",
      "강릉",
      "속초",
      "춘천",
      "원주",
    ];
    const mentioned = pool.filter(
      (h) =>
        prompt.includes(h) ||
        (slots.regions || []).some(
          (r) => r.includes(h) || h.includes(r.replace(/(시|군)$/, ""))
        )
    );

    const pick = (mentioned.length ? mentioned : ["영월", "정선", "태백", "춘천", "강릉"])
      .map((h) => cards.find((c) => c.city.includes(h)))
      .filter(Boolean);

    const unique = [...new Map(pick.map((c) => [c!.city, c!])).values()].slice(0, 6);
    const dateLine =
      slots.startDate || slots.endDate
        ? `여행일: ${slots.startDate || "?"}${slots.endDate && slots.endDate !== slots.startDate ? ` ~ ${slots.endDate}` : ""}`
        : "여행일: 미정(오늘 날씨 참고)";

    const lines = unique.map(
      (c) => `${c.city} ${c.temp ?? "?"}° ${c.label} ${c.range}${c.tip ? ` · ${c.tip}` : ""}`
    );

    // 단기 예보: 시작일이 16일 이내면 daily 한 줄 보강
    const start = slots.startDate ? parseYmdDash(slots.startDate) : null;
    let forecastExtra = "";
    if (start && unique[0]) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.round((start.getTime() - today.getTime()) / 86_400_000);
      if (diff >= 0 && diff <= 14) {
        forecastExtra = await dailyForecastLine(unique[0].city, start, slots.endDate);
      }
    }

    const base = [dateLine, ...lines, forecastExtra].filter(Boolean).join("\n");
    const mashup = congestionMashupNote(slots, base);
    return [base, mashup].filter(Boolean).join("\n\n");
  } catch {
    return "";
  }
}

async function dailyForecastLine(
  cityName: string,
  start: Date,
  endYmd?: string
): Promise<string> {
  const city = getCities().find((c) => c.city.includes(cityName.replace(/(시|군)$/, "")) || cityName.includes(c.city));
  if (!city) return "";
  const end = endYmd ? parseYmdDash(endYmd) || start : start;
  const days = Math.min(7, Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1));
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
      `&timezone=Asia%2FSeoul&forecast_days=16`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return "";
    const data = await res.json();
    const times: string[] = data?.daily?.time || [];
    const his: number[] = data?.daily?.temperature_2m_max || [];
    const los: number[] = data?.daily?.temperature_2m_min || [];
    const pops: number[] = data?.daily?.precipitation_probability_max || [];
    const startKey = toYmd(start);
    const idx = times.indexOf(startKey);
    if (idx < 0) return "";
    const parts: string[] = [];
    for (let i = idx; i < Math.min(times.length, idx + days); i++) {
      parts.push(
        `${times[i]} ${city.city} ${Math.round(los[i])}~${Math.round(his[i])}° 강수확률 ${pops[i] ?? "?"}%`
      );
    }
    return parts.length ? `예보:\n${parts.join("\n")}` : "";
  } catch {
    return "";
  }
}

export function mergeSlots(prev: ChatSlots, next: Partial<ChatSlots> | null | undefined): ChatSlots {
  if (!next) return prev;
  const out: ChatSlots = { ...prev };
  for (const [k, v] of Object.entries(next) as [keyof ChatSlots, ChatSlots[keyof ChatSlots]][]) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function slotsSummary(slots: ChatSlots): string {
  const parts: string[] = [];
  if (slots.startDate || slots.endDate) {
    parts.push(
      `일정 ${slots.startDate || "?"}${slots.endDate && slots.endDate !== slots.startDate ? `~${slots.endDate}` : ""}`
    );
  }
  if (slots.duration) parts.push(slots.duration);
  if (slots.regions?.length) parts.push(slots.regions.join("·"));
  if (slots.themes?.length) parts.push(slots.themes.join("·"));
  if (slots.companion) parts.push(slots.companion);
  if (slots.budget) parts.push(slots.budget);
  if (slots.origin) parts.push(`출발 ${slots.origin}`);
  if (slots.destination) parts.push(`도착 ${slots.destination}`);
  if (slots.mode) {
    const label =
      slots.mode === "walk" ? "도보" : slots.mode === "bicycle" ? "자전거" : "자동차";
    parts.push(label);
  }
  return parts.join(" · ");
}

export function buildPlanPrompt(userText: string, slots: ChatSlots): string {
  const modeLabel =
    slots.mode === "walk"
      ? "도보"
      : slots.mode === "bicycle"
        ? "자전거"
        : slots.mode === "car"
          ? "자동차"
          : "";
  const bits = [
    userText,
    slotsSummary(slots),
    slots.duration ? `기간: ${slots.duration}` : "",
    slots.origin ? `출발지: ${slots.origin}` : "",
    slots.destination ? `도착지: ${slots.destination}` : "",
    modeLabel ? `이동수단: ${modeLabel}` : "",
    slots.regions?.length
      ? `희망 권역: ${slots.regions.join(", ")}`
      : slots.origin || slots.destination
        ? "권역은 출발·도착 가는 길에 맞출 것. 특정 시·군으로 고정하지 말 것."
        : "강원 18개 시·군 중 요청에 나온 곳만. 정선·영월로 고정하지 말 것.",
  ].filter(Boolean);
  return bits.join("\n");
}
