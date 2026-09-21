import { QUIET_REGIONS } from "@/lib/prefs";
import merchantsJson from "@/data/local_merchants.json";

export type LocalMerchant = {
  id: string;
  name: string;
  region: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  pay: string[];
  note?: string;
  source?: "seed" | "kakao";
  distanceKm?: number;
};

export type CatalogBenefitItem = {
  id: string;
  name: string;
  summary: string;
  url: string;
  regions: string[];
};

/** catalog.local_benefits 미러 — 클라이언트 안전 (fs 없음) */
export const CATALOG_BENEFITS: {
  title: string;
  items: CatalogBenefitItem[];
} = {
  title: "로컬 경제 활성화 혜택",
  items: [
    {
      id: "digital_resident",
      name: "디지털 관광주민증",
      summary:
        "인구감소·소외 지역 방문 시 할인·체험 혜택을 받을 수 있는 관광주민증을 확인하세요.",
      url: "https://www.tour.go.kr/",
      regions: [
        "정선군",
        "태백시",
        "영월군",
        "삼척시",
        "평창군",
        "횡성군",
        "화천군",
        "양구군",
        "인제군",
        "고성군",
        "철원군",
      ],
    },
    {
      id: "gangwon_voucher",
      name: "강원상품권·지역화폐",
      summary:
        "강원상품권·지역사랑상품권 가맹점에서 식사·체험·기념품을 결제하면 지역 상권에 바로 도움이 됩니다.",
      url: "https://www.gwgs.kr.gov.kr/",
      regions: [],
    },
  ],
};

const SEED: LocalMerchant[] = (
  (merchantsJson as { items?: LocalMerchant[] }).items || []
).map((m) => ({ ...m, source: "seed" as const }));

export function getSeedMerchants(): LocalMerchant[] {
  return SEED;
}

export function getCatalogBenefits() {
  return CATALOG_BENEFITS;
}

export function benefitsForTripRegions(regions: string[]): CatalogBenefitItem[] {
  const set = new Set(regions);
  return CATALOG_BENEFITS.items.filter(
    (it) => !it.regions?.length || it.regions.some((r) => set.has(r))
  );
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 스팟 좌표 기준 가까운 시드 가맹점 */
export function merchantsNear(
  lat: number,
  lng: number,
  opts?: { region?: string; limit?: number; maxKm?: number }
): LocalMerchant[] {
  const limit = opts?.limit ?? 3;
  const maxKm = opts?.maxKm ?? 25;
  const region = opts?.region;

  const scored = getSeedMerchants()
    .filter((m) => !region || m.region === region)
    .map((m) => ({
      ...m,
      distanceKm: Math.round(haversineKm({ lat, lng }, m) * 10) / 10,
    }))
    .filter((m) => (m.distanceKm || 0) <= maxKm)
    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));

  let out = scored.slice(0, limit);
  if (out.length < limit && region) {
    const more = getSeedMerchants()
      .filter((m) => m.region === region && !out.some((o) => o.id === m.id))
      .map((m) => ({
        ...m,
        distanceKm: Math.round(haversineKm({ lat, lng }, m) * 10) / 10,
      }))
      .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    out = [...out, ...more].slice(0, limit);
  }
  if (
    !out.length &&
    region &&
    (QUIET_REGIONS as readonly string[]).includes(region)
  ) {
    out = getSeedMerchants()
      .filter((m) => m.region === region)
      .slice(0, limit)
      .map((m) => ({
        ...m,
        distanceKm: Math.round(haversineKm({ lat, lng }, m) * 10) / 10,
      }));
  }
  return out;
}
