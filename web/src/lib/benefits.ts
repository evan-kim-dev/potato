import { QUIET_REGIONS } from "@/lib/prefs";
import {
  benefitsForTripRegions,
  getCatalogBenefits,
} from "@/lib/merchants";

const QUIET_SET = new Set<string>(QUIET_REGIONS);

export type LocalBenefit = {
  regions: string[];
  title: string;
  body: string;
  links: Array<{ label: string; href: string; id?: string }>;
};

/** 제안서: 소외·인구감소 권역 방문 시 관광주민증·지역화폐 안내 */
export function benefitsForRegions(regions: string[]): LocalBenefit | null {
  const hit = [...new Set(regions.filter((r) => QUIET_SET.has(r)))];
  if (!hit.length) return null;

  const short = hit.map((r) => r.replace(/(시|군)$/, "")).join("·");
  const catalog = getCatalogBenefits();
  const matched = benefitsForTripRegions(hit);
  const items = matched.length ? matched : catalog.items;

  const links =
    items.length > 0
      ? items.map((it) => ({
          id: it.id,
          label: it.name,
          href: it.url || "https://www.gangwon.to/gwtour",
        }))
      : [
          {
            id: "gangwon-tour",
            label: "강원관광(공식)",
            href: "https://www.gangwon.to/gwtour",
          },
          {
            id: "gwgs",
            label: "강원상품권",
            href: "https://www.gwgs.kr.gov.kr/",
          },
        ];

  const bodyBits = items
    .map((it) => it.summary)
    .filter(Boolean)
    .slice(0, 2);
  const body =
    bodyBits.join(" ") ||
    "소멸위험·한산 권역을 방문하는 코스예요. 체류·소비가 지역에 남도록 디지털 관광주민증과 강원페이(지역화폐)를 확인하세요.";

  return {
    regions: hit,
    title: `${short} · ${catalog.title}`,
    body,
    links,
  };
}

export function isQuietRegion(region: string) {
  if (!region) return false;
  if (QUIET_SET.has(region)) return true;
  const short = region.replace(/(시|군|특별자치도|도)$/, "").trim();
  return [...QUIET_SET].some((r) => {
    const rs = r.replace(/(시|군)$/, "");
    return region.includes(rs) || short === rs;
  });
}

/** 혜택 링크 CTR (임팩트 KPI용 · 로컬) */
const CTR_KEY = "gw_benefit_ctr_v1";

export function trackBenefitClick(id: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CTR_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[id] = (map[id] || 0) + 1;
    map._total = (map._total || 0) + 1;
    localStorage.setItem(CTR_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function loadBenefitCtr(): {
  total: number;
  byId: Record<string, number>;
} {
  if (typeof window === "undefined") return { total: 0, byId: {} };
  try {
    const raw = localStorage.getItem(CTR_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const total = map._total || 0;
    const byId = { ...map };
    delete byId._total;
    return { total, byId };
  } catch {
    return { total: 0, byId: {} };
  }
}

/** 관리자 데모 시드용 · map은 `_total` 포함 가능 */
export function setBenefitCtr(map: Record<string, number>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CTR_KEY, JSON.stringify(map));
}
