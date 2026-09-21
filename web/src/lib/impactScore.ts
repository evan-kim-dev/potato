import { areRegionsAdjacent, QUIET_REGIONS } from "@/lib/prefs";
import type { TripPlan } from "@/lib/tripTypes";

const QUIET = new Set<string>(QUIET_REGIONS);
const COASTAL_HOT = new Set(["강릉시", "속초시", "양양군"]);

export type DispersionScore = {
  /** 0–100, 높을수록 인구감소·저밀도·인접 동선에 부합 */
  score: number;
  grade: "A" | "B" | "C" | "D";
  label: string;
  quietRatio: number;
  quietStops: number;
  totalStops: number;
  adjacentLegs: number;
  totalLegs: number;
  coastalHotStops: number;
  esgNote: string;
};

function gradeOf(score: number): DispersionScore["grade"] {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 45) return "C";
  return "D";
}

function labelOf(grade: DispersionScore["grade"]): string {
  switch (grade) {
    case "A":
      return "저밀도 우수";
    case "B":
      return "분산 양호";
    case "C":
      return "보통";
    default:
      return "핫플 편중";
  }
}

/**
 * 제안서 ESG·관광객 분산 의도 점수.
 * — 한산 권역 비중, 인접 동선, 해안 핫플 비중으로 산출.
 */
export function scoreTripDispersion(
  steps: Array<{ spot: { region: string } }>
): DispersionScore {
  const totalStops = steps.length;
  if (!totalStops) {
    return {
      score: 0,
      grade: "D",
      label: "일정 없음",
      quietRatio: 0,
      quietStops: 0,
      totalStops: 0,
      adjacentLegs: 0,
      totalLegs: 0,
      coastalHotStops: 0,
      esgNote: "일정이 비어 있어요.",
    };
  }

  const quietStops = steps.filter((s) => QUIET.has(s.spot.region)).length;
  const coastalHotStops = steps.filter((s) =>
    COASTAL_HOT.has(s.spot.region)
  ).length;
  const quietRatio = quietStops / totalStops;

  let adjacentLegs = 0;
  const totalLegs = Math.max(0, totalStops - 1);
  for (let i = 0; i < totalLegs; i++) {
    if (areRegionsAdjacent(steps[i].spot.region, steps[i + 1].spot.region)) {
      adjacentLegs += 1;
    }
  }
  const adjacentRatio = totalLegs ? adjacentLegs / totalLegs : 1;
  const coastalPenalty = coastalHotStops / totalStops;

  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        quietRatio * 55 + adjacentRatio * 35 + (1 - coastalPenalty) * 10
      )
    )
  );
  const grade = gradeOf(score);

  const esgNote =
    grade === "A" || grade === "B"
      ? "혼잡 분산·한산 체류로 지역 상권·저밀도 여행(ESG)에 기여하는 코스예요."
      : grade === "C"
        ? "일부 핫플이 섞여 있어요. 인접 한산 권역을 더 넣으면 분산 효과가 커집니다."
        : "해안·핫플 편중이 커요. 인구감소 권역으로 동선을 옮겨 보세요.";

  return {
    score,
    grade,
    label: labelOf(grade),
    quietRatio,
    quietStops,
    totalStops,
    adjacentLegs,
    totalLegs,
    coastalHotStops,
    esgNote,
  };
}

export function withDispersionSummary(plan: TripPlan): TripPlan {
  const d = scoreTripDispersion(plan.steps);
  const tag = `분산 ${d.score}·${d.grade}`;
  const summary = plan.summary.includes("분산")
    ? plan.summary
    : `${plan.summary} · ${tag}`;
  return { ...plan, summary, dispersion: d };
}

/** 날씨·축제·권역유형 → 혼잡 프록시 (통신사 유동인구 대체 MVP) */
export type CongestionHint = {
  region: string;
  level: "low" | "mid" | "high";
  label: string;
  reasons: string[];
};

export function congestionHintForRegion(opts: {
  region: string;
  isQuiet: boolean;
  isCoastalHot?: boolean;
  festivalCount?: number;
  weatherLabel?: string;
}): CongestionHint {
  const reasons: string[] = [];
  let points = 0;

  if (opts.isCoastalHot) {
    points += 2;
    reasons.push("해안 핫플 권역");
  }
  if (opts.isQuiet) {
    points -= 2;
    reasons.push("인구감소·한산 권역");
  }
  if ((opts.festivalCount || 0) >= 2) {
    points += 2;
    reasons.push(`행사 ${opts.festivalCount}건`);
  } else if ((opts.festivalCount || 0) === 1) {
    points += 1;
    reasons.push("행사 예정");
  }
  const w = opts.weatherLabel || "";
  if (/맑|구름 조금/.test(w)) {
    points += 1;
    reasons.push("야외 활동 좋은 날씨");
  } else if (/비|눈|뇌우/.test(w)) {
    points -= 1;
    reasons.push("기상으로 야외 혼잡 완화 가능");
  }

  let level: CongestionHint["level"] = "mid";
  if (points <= 0) level = "low";
  else if (points >= 3) level = "high";

  const label =
    level === "low"
      ? "한산·여유"
      : level === "high"
        ? "혼잡 우려 · 인접 한산으로"
        : "보통";

  return { region: opts.region, level, label, reasons: reasons.slice(0, 3) };
}
