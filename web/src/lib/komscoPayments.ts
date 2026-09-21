import { QUIET_REGIONS } from "@/lib/prefs";
import { GANGWON_RGN_CODES, RGN_CODE_TO_REGION } from "@/lib/komscoRegions";

export type KomscoPaymentRow = {
  crtr_ym?: string;
  usage_rgn_cd?: string;
  par_gend?: string;
  par_ag?: string;
  stlm_nocs?: number;
  stlm_amt?: number;
  card_use_amt?: number;
  mbl_user_cnt?: number;
  mbl_use_amt?: number;
  emd_cd?: string;
  emd_nm?: string;
};

export type RegionPaymentAgg = {
  region: string;
  code: string;
  amount: number;
  count: number;
  quiet: boolean;
};

export type KomscoPaymentsPayload = {
  updated_at: string;
  source: string;
  period: { from: string; to: string };
  ok: boolean;
  note?: string;
  regions: RegionPaymentAgg[];
  totalAmount: number;
  totalCount: number;
  quietAmount: number;
  quietSharePct: number;
};

const ENDPOINT =
  "https://apis.data.go.kr/B190001/localGiftsPaymentV3/paymentsV3";

function ymMonthsAgo(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

function getServiceKey() {
  return (
    process.env.DATA_GO_KR_SERVICE_KEY ||
    process.env.TOUR_API_SERVICE_KEY ||
    process.env.KOMSCO_PAYMENT_KEY ||
    ""
  ).trim();
}

async function loadCachedKomscoPayments(): Promise<KomscoPaymentsPayload | null> {
  try {
    const { readFileSync } = await import("fs");
    const path = await import("path");
    const file = path.join(
      process.cwd(),
      "..",
      "backend",
      "data",
      "komsco_payments.json"
    );
    const raw = readFileSync(file, "utf-8");
    return JSON.parse(raw) as KomscoPaymentsPayload;
  } catch {
    return null;
  }
}

function aggregateRows(
  rows: KomscoPaymentRow[],
  period: { from: string; to: string }
): KomscoPaymentsPayload {
  const byCode = new Map<string, { amount: number; count: number }>();
  for (const r of rows) {
    const code = String(r.usage_rgn_cd || "").trim();
    if (!code || !RGN_CODE_TO_REGION[code]) continue;
    const cur = byCode.get(code) || { amount: 0, count: 0 };
    cur.amount += Number(r.stlm_amt) || 0;
    cur.count += Number(r.stlm_nocs) || 0;
    byCode.set(code, cur);
  }

  const quiet = new Set<string>(QUIET_REGIONS);
  const regions: RegionPaymentAgg[] = [...byCode.entries()]
    .map(([code, v]) => {
      const region = RGN_CODE_TO_REGION[code];
      return {
        region,
        code,
        amount: v.amount,
        count: v.count,
        quiet: quiet.has(region),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const totalAmount = regions.reduce((s, r) => s + r.amount, 0);
  const totalCount = regions.reduce((s, r) => s + r.count, 0);
  const quietAmount = regions
    .filter((r) => r.quiet)
    .reduce((s, r) => s + r.amount, 0);

  return {
    updated_at: new Date().toISOString(),
    source: "한국조폐공사_지역사랑상품권_결제정보 paymentsV3",
    period,
    ok: true,
    regions,
    totalAmount,
    totalCount,
    quietAmount,
    quietSharePct: totalAmount
      ? Math.round((quietAmount / totalAmount) * 100)
      : 0,
  };
}

/** 공공데이터포털 키로 강원 시·군 결제 집계 (서버 전용) */
export async function fetchGangwonPaymentsLive(opts?: {
  monthsBack?: number;
  perPage?: number;
}): Promise<KomscoPaymentsPayload> {
  const key = getServiceKey();
  const period = {
    from: ymMonthsAgo(opts?.monthsBack ?? 3),
    to: ymMonthsAgo(1),
  };

  if (!key) {
    const cached = await loadCachedKomscoPayments();
    if (cached) return { ...cached, note: cached.note || "캐시 JSON (키 없음)" };
    return {
      updated_at: new Date().toISOString(),
      source: "한국조폐공사_지역사랑상품권_결제정보 paymentsV3",
      period,
      ok: false,
      note: "DATA_GO_KR_SERVICE_KEY(또는 TOUR_API_SERVICE_KEY) 없음 · 캐시 대기",
      regions: [],
      totalAmount: 0,
      totalCount: 0,
      quietAmount: 0,
      quietSharePct: 0,
    };
  }

  const rows: KomscoPaymentRow[] = [];
  const codes = Object.values(GANGWON_RGN_CODES);
  const perPage = opts?.perPage ?? 1000;

  const settled = await Promise.all(
    codes.map(async (code) => {
      const params = new URLSearchParams();
      params.set("serviceKey", key);
      params.set("page", "1");
      params.set("perPage", String(perPage));
      params.set("returnType", "JSON");
      params.set("cond[crtr_ym::GTE]", period.from);
      params.set("cond[crtr_ym::LTE]", period.to);
      params.set("cond[usage_rgn_cd::EQ]", code);
      try {
        const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
          next: { revalidate: 3600 },
        });
        if (!res.ok) return [] as KomscoPaymentRow[];
        const json = await res.json();
        const data = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
            ? json
            : [];
        return data as KomscoPaymentRow[];
      } catch {
        return [] as KomscoPaymentRow[];
      }
    })
  );
  for (const batch of settled) rows.push(...batch);

  const agg = aggregateRows(rows, period);
  if (!rows.length) {
    return {
      ...agg,
      ok: false,
      note: "응답 0건 · 키·기간·지역코드 확인 (마이페이지 개발계정)",
    };
  }
  return agg;
}
