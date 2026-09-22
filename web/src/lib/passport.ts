import { QUIET_REGIONS } from "@/lib/prefs";

export type PassportStamp = {
  region: string;
  short: string;
  count: number;
  firstAt: string;
  lastAt: string;
  tripIds: string[];
};

export type QuietPassport = {
  stamps: PassportStamp[];
  /** 한산 권역 누적 방문(일정 저장) 횟수 */
  totalQuietVisits: number;
  updatedAt: string;
};

const KEY = "gw_quiet_passport_v1";

function read(): QuietPassport {
  if (typeof window === "undefined") {
    return { stamps: [], totalQuietVisits: 0, updatedAt: "" };
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { stamps: [], totalQuietVisits: 0, updatedAt: "" };
    return JSON.parse(raw) as QuietPassport;
  } catch {
    return { stamps: [], totalQuietVisits: 0, updatedAt: "" };
  }
}

function write(p: QuietPassport) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function loadPassport(): QuietPassport {
  return read();
}

/** 관리자 데모 시드·초기화용 */
export function replacePassport(p: QuietPassport): QuietPassport {
  const next: QuietPassport = {
    stamps: p.stamps || [],
    totalQuietVisits: p.totalQuietVisits ?? 0,
    updatedAt: p.updatedAt || new Date().toISOString(),
  };
  write(next);
  return next;
}

/** 일정에 포함된 한산 시·군을 여권 스탬프로 적립 */
export function stampQuietRegionsFromTrip(
  tripId: string,
  regions: string[]
): QuietPassport {
  const quiet = [...new Set(regions.filter((r) => (QUIET_REGIONS as readonly string[]).includes(r)))];
  const passport = read();
  const now = new Date().toISOString();
  const byRegion = new Map(passport.stamps.map((s) => [s.region, s]));

  for (const region of quiet) {
    const prev = byRegion.get(region);
    if (prev) {
      if (!prev.tripIds.includes(tripId)) {
        prev.count += 1;
        prev.lastAt = now;
        prev.tripIds = [...prev.tripIds, tripId].slice(-12);
      }
    } else {
      byRegion.set(region, {
        region,
        short: region.replace(/(시|군)$/, ""),
        count: 1,
        firstAt: now,
        lastAt: now,
        tripIds: [tripId],
      });
    }
  }

  const stamps = [...byRegion.values()].sort((a, b) =>
    a.short.localeCompare(b.short, "ko")
  );
  const next: QuietPassport = {
    stamps,
    totalQuietVisits: stamps.reduce((n, s) => n + s.count, 0),
    updatedAt: now,
  };
  write(next);
  return next;
}

export function passportProgress() {
  const p = read();
  const collected = p.stamps.length;
  const total = QUIET_REGIONS.length;
  return {
    collected,
    total,
    ratio: total ? collected / total : 0,
    remaining: QUIET_REGIONS.filter(
      (r) => !p.stamps.some((s) => s.region === r)
    ),
  };
}

export function passportTier(collected: number): {
  tier: string;
  blurb: string;
} {
  if (collected >= 8)
    return {
      tier: "온도 대사",
      blurb: "한산 권역을 두루 잇는 로컬 여행자예요.",
    };
  if (collected >= 5)
    return {
      tier: "온도 탐험가",
      blurb: "인구감소 권역 발길이 눈에 띄게 쌓였어요.",
    };
  if (collected >= 2)
    return {
      tier: "온도 입문자",
      blurb: "한산 여권에 첫 스탬프가 찍혔어요.",
    };
  if (collected >= 1)
    return {
      tier: "첫 발길",
      blurb: "한 곳이라도 한산 권역을 일정에 담았어요.",
    };
  return {
    tier: "미발급",
    blurb: "한산 권역 일정을 찜하면 스탬프가 쌓입니다.",
  };
}
