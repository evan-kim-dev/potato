export const PREFERENCE_OPTIONS = {
  themes: [
    { id: "nature", label: "자연" },
    { id: "sea", label: "바다" },
    { id: "cafe", label: "카페" },
    { id: "drive", label: "드라이브" },
    { id: "culture", label: "문화" },
    { id: "quiet", label: "한산" },
  ],
  companions: [
    { id: "solo", label: "혼자" },
    { id: "couple", label: "연인" },
    { id: "friends", label: "친구" },
    { id: "family", label: "가족" },
  ],
  budgets: [
    { id: "thrifty", label: "알뜰" },
    { id: "balanced", label: "보통" },
    { id: "comfort", label: "여유" },
  ],
} as const;

/** 제안서 Phase1: 인구감소·내륙 소외 권역 */
export const QUIET_REGIONS = [
  "영월군",
  "정선군",
  "태백시",
  "양구군",
  "인제군",
  "화천군",
  "철원군",
  "고성군",
] as const;

/** 해안 핫플 → 인접 한산·분산 권역 (제안서 GIS 분산) */
export const COASTAL_TO_QUIET: Record<string, string[]> = {
  강릉시: ["정선군", "평창군", "영월군"],
  속초시: ["인제군", "양구군", "고성군"],
  양양군: ["인제군", "고성군", "홍천군"],
  동해시: ["삼척시", "정선군", "태백시"],
  삼척시: ["태백시", "정선군", "영월군"],
};

/** 내륙 연계(한산 MVP는 아니지만 핫플이 아닌 권역) */
export const BRIDGE_REGIONS = ["평창군", "홍천군", "횡성군"] as const;

/**
 * 강원 시·군 인접 그래프 (실제 접경 기준).
 * 일정은 같은 클러스터·인접지만 이어가도록 후보·동선에 사용.
 */
export const REGION_NEIGHBORS: Record<string, string[]> = {
  철원군: ["화천군", "춘천시"],
  화천군: ["철원군", "춘천시", "양구군", "인제군"],
  춘천시: ["철원군", "화천군", "양구군", "홍천군"],
  양구군: ["화천군", "인제군", "춘천시"],
  인제군: ["양구군", "화천군", "홍천군", "양양군", "속초시", "고성군"],
  고성군: ["속초시", "인제군"],
  속초시: ["고성군", "양양군", "인제군"],
  양양군: ["속초시", "강릉시", "인제군", "홍천군"],
  홍천군: ["춘천시", "인제군", "양양군", "강릉시", "평창군", "횡성군"],
  횡성군: ["원주시", "홍천군", "평창군", "영월군"],
  원주시: ["횡성군", "영월군"],
  평창군: ["홍천군", "횡성군", "강릉시", "정선군", "영월군"],
  강릉시: ["양양군", "동해시", "평창군", "정선군", "홍천군"],
  동해시: ["강릉시", "삼척시", "정선군"],
  삼척시: ["동해시", "태백시", "정선군"],
  태백시: ["삼척시", "정선군", "영월군"],
  정선군: ["평창군", "강릉시", "동해시", "삼척시", "태백시", "영월군"],
  영월군: ["정선군", "태백시", "평창군", "횡성군", "원주시"],
};

/** 한산·연계 기본 클러스터 (권역 미지정 시 하나만 고름) */
export const REGION_CLUSTERS: string[][] = [
  ["영월군", "정선군", "태백시", "평창군"],
  ["양구군", "인제군", "화천군", "철원군", "고성군"],
  ["홍천군", "횡성군", "평창군", "영월군"],
  ["삼척시", "태백시", "정선군", "동해시"],
];

const ALL_REGIONS = Object.keys(REGION_NEIGHBORS);

export function normalizeRegionName(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (REGION_NEIGHBORS[t]) return t;
  const short = t.replace(/(시|군)$/, "");
  return ALL_REGIONS.find((r) => r.replace(/(시|군)$/, "") === short) || null;
}

/** 문장에서 강원 시·군 추출 */
export function regionsMentionedInText(...texts: string[]): string[] {
  const blob = texts.filter(Boolean).join(" ");
  if (!blob) return [];
  const hit: string[] = [];
  for (const r of ALL_REGIONS) {
    const short = r.replace(/(시|군)$/, "");
    if (blob.includes(r) || blob.includes(short)) hit.push(r);
  }
  return [...new Set(hit)];
}

/** seed 시·군에서 hops만큼 인접 확장 */
export function expandAdjacentRegions(seeds: string[], hops = 1): Set<string> {
  const out = new Set<string>();
  let frontier = seeds
    .map((s) => normalizeRegionName(s))
    .filter((s): s is string => !!s);
  for (const s of frontier) out.add(s);
  for (let h = 0; h < hops; h++) {
    const next: string[] = [];
    for (const r of frontier) {
      for (const n of REGION_NEIGHBORS[r] || []) {
        if (!out.has(n)) {
          out.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return out;
}

export function areRegionsAdjacent(a: string, b: string): boolean {
  const ra = normalizeRegionName(a);
  const rb = normalizeRegionName(b);
  if (!ra || !rb) return false;
  if (ra === rb) return true;
  return (REGION_NEIGHBORS[ra] || []).includes(rb);
}

/** 권역 미지정 시 연결된 한 클러스터만 고름 (도 전체 분산 방지) */
export function pickDefaultRegionCluster(seedText = ""): string[] {
  const n = [...seedText].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return REGION_CLUSTERS[Math.abs(n) % REGION_CLUSTERS.length];
}

export function dispersionTargetsFor(region: string): string[] {
  return COASTAL_TO_QUIET[region] || [];
}

/** API body에서 취향 라벨 문자열 합치기 */
export function prefsLabelFromBody(body: Record<string, unknown> | null | undefined): string {
  if (!body) return "";
  const note = String(body.prefs || "").trim();
  const structured = body.prefsStructured as
    | { themes?: string[]; companion?: string; budget?: string }
    | undefined;
  if (!structured) return note;

  const labels: string[] = [];
  for (const id of structured.themes || []) {
    const hit = PREFERENCE_OPTIONS.themes.find((t) => t.id === id);
    if (hit) labels.push(hit.label);
  }
  if (structured.companion) labels.push(structured.companion);
  if (structured.budget) labels.push(structured.budget);
  const built = labels.join(", ");
  return [built, note].filter(Boolean).join(" · ");
}
