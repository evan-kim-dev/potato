import { QUIET_REGIONS } from "@/lib/prefs";
import {
  loadAuth,
  loginLocal,
  loadCommunityPosts,
  saveCommunityPosts,
  saveTripForUser,
  deleteTripForUser,
  setCurrentTrip,
  type CommunityPost,
} from "@/lib/storage";
import type { TripPlan } from "@/lib/tripTypes";
import {
  replacePassport,
  stampQuietRegionsFromTrip,
  type QuietPassport,
} from "@/lib/passport";
import { setBenefitCtr } from "@/lib/benefits";
import { clearPayReceipts, savePayReceipt } from "@/lib/payReceipts";
import { scoreTripDispersion } from "@/lib/impactScore";

const DEMO_FLAG = "gw_demo_seed_v1";
const DEMO_USER = "심사데모";
const DEMO_TRIP_ID = "demo-trip-quiet-cluster";

type DemoPack = {
  ok: boolean;
  source?: string;
  trip: {
    id: string;
    query: string;
    title: string;
    summary: string;
    duration: string;
    source: string;
    stopNames: string[];
    mode: "car";
    steps: TripPlan["steps"];
    dispersion: TripPlan["dispersion"];
    regions: string[];
  };
  merchant: { name: string; region: string; amount: number };
  communityHints: Array<{ region: string; name: string }>;
};

function fallbackPosts(): CommunityPost[] {
  return [
    {
      id: "seed-review-yeongwol",
      type: "review",
      author: "한산여행러",
      authorId: "seed:han",
      region: "영월군",
      title: "청령포 한산 코스 추천",
      body: "속초 대신 영월로 갔어요. 사람이 적어 여유로웠습니다.",
      tags: ["한산", "영월"],
      likes: 12,
      createdAt: "2026-09-18T10:00:00.000Z",
      aiPrompt: "영월 당일 한산 코스",
    },
    {
      id: "seed-tip-jeongseon",
      type: "tip",
      author: "온도입문자",
      authorId: "seed:ondoh",
      region: "정선군",
      title: "정선·태백 1박 팁",
      body: "아리랑 권역에서 태백으로 이어가면 동선이 짧아요.",
      tags: ["정선", "태백"],
      likes: 8,
      createdAt: "2026-09-19T14:30:00.000Z",
      aiPrompt: "정선 태백 1박2일 조용히",
    },
    {
      id: "seed-q-inje",
      type: "question",
      author: "게스트",
      authorId: "seed:guest",
      region: "인제군",
      title: "인제·양구 우회 코스?",
      body: "해안이 붐빌 때 한산 우회 코스로 짜고 싶어요.",
      tags: ["인제", "질문"],
      likes: 3,
      createdAt: "2026-09-20T09:15:00.000Z",
      aiPrompt: "속초 대신 인제 양구 한산 코스",
    },
  ];
}

function postsFromHints(
  hints: Array<{ region: string; name: string }>
): CommunityPost[] {
  if (!hints.length) return fallbackPosts();
  return hints.map((h, i) => {
    const short = h.region.replace(/(시|군)$/, "");
    const types = ["review", "tip", "question"] as const;
    const type = types[i % types.length];
    return {
      id: `seed-catalog-${i}-${h.name.slice(0, 8)}`,
      type,
      author: i === 0 ? "한산여행러" : i === 1 ? "온도입문자" : "로컬체류",
      authorId: `seed:pack${i}`,
      region: h.region,
      title:
        type === "question"
          ? `${short} ${h.name} 주차·혼잡 어때요?`
          : `${h.name} · ${short} 한산 후기`,
      body:
        type === "tip"
          ? `${h.name}은(는) TourAPI 카탈로그 한산 스팟이에요. 인접 권역과 묶으면 분산 점수가 좋아요.`
          : type === "question"
            ? `주말에 ${h.name} 가려는데 해안 대신 한산 우회가 나을까요?`
            : `${h.name}에서 여유롭게 보냈어요. 인구감소 권역이라 한산했어요.`,
      tags: ["한산", short, "TourAPI"],
      likes: 5 + i * 3,
      createdAt: new Date(Date.now() - i * 86_400_000).toISOString(),
      aiPrompt: `${short} ${h.name} 한산 코스`,
    };
  });
}

function fallbackTrip(): TripPlan {
  const now = new Date().toISOString();
  const steps: TripPlan["steps"] = [
    {
      order: 1,
      day: 1,
      stay: 90,
      why: "한산 권역 폴백 스팟",
      spot: {
        name: "정선 아리랑 마을",
        region: "정선군",
        description: "정선 한산 권역",
        lat: 37.3808,
        lng: 128.6608,
        theme: "문화",
      },
    },
    {
      order: 2,
      day: 1,
      stay: 80,
      why: "인접 영월",
      spot: {
        name: "영월 청령포",
        region: "영월군",
        description: "단종 유배지",
        lat: 37.1765,
        lng: 128.4452,
        theme: "역사",
      },
    },
    {
      order: 3,
      day: 1,
      stay: 60,
      why: "체류 마무리",
      spot: {
        name: "동강전망공원",
        region: "영월군",
        description: "동강 뷰",
        lat: 37.1834,
        lng: 128.461,
        theme: "자연",
      },
    },
  ];
  const dispersion = scoreTripDispersion(steps);
  return {
    id: DEMO_TRIP_ID,
    query: "정선·영월 당일 한산 코스",
    savedAt: now,
    title: "정선·영월 한산 클러스터",
    summary: `폴백 데모 코스 · 분산 ${dispersion.score}·${dispersion.grade}`,
    duration: "당일",
    source: "demo-seed-fallback",
    stopNames: steps.map((s) => s.spot.name),
    mode: "car",
    dispersion,
    steps,
  };
}

async function fetchDemoPack(): Promise<DemoPack | null> {
  try {
    const res = await fetch("/api/demo/pack", { cache: "force-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as DemoPack;
    if (!data?.ok || !data.trip?.steps?.length) return null;
    return data;
  } catch {
    return null;
  }
}

function passportFromRegions(regions: string[], tripId: string): QuietPassport {
  const now = new Date().toISOString();
  const quiet = [
    ...new Set(regions.filter((r) => (QUIET_REGIONS as readonly string[]).includes(r))),
  ];
  const base = quiet.length ? quiet : ["정선군", "영월군", "태백시", "인제군"];
  return {
    stamps: base.map((region) => ({
      region,
      short: region.replace(/(시|군)$/, ""),
      count: region === base[0] ? 2 : 1,
      firstAt: now,
      lastAt: now,
      tripIds: [tripId],
    })),
    totalQuietVisits: base.length + 1,
    updatedAt: now,
  };
}

export function isDemoSeeded(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEMO_FLAG) === "1";
}

export type DemoSeedResult = {
  ok: true;
  userId: string;
  source: "catalog" | "fallback";
  tripTitle: string;
};

/**
 * 심사 데모 — 가능하면 TourAPI 카탈로그 실스팟으로 일정·여권·이야기·영수증을 채움.
 * 강원페이 영수증 저장은 로컬 MOCK (실제 결제 API 아님).
 */
export async function applyDemoSeed(): Promise<DemoSeedResult> {
  const auth = loadAuth() || loginLocal(DEMO_USER);
  const pack = await fetchDemoPack();

  const now = new Date().toISOString();
  let trip: TripPlan;
  let merchant: { name: string; region: string; amount: number };
  let posts: CommunityPost[];
  let source: "catalog" | "fallback";

  if (pack) {
    source = "catalog";
    trip = {
      id: pack.trip.id || DEMO_TRIP_ID,
      query: pack.trip.query,
      savedAt: now,
      title: pack.trip.title,
      summary: pack.trip.summary,
      duration: pack.trip.duration,
      source: pack.trip.source,
      stopNames: pack.trip.stopNames,
      mode: pack.trip.mode,
      steps: pack.trip.steps,
      dispersion: pack.trip.dispersion || scoreTripDispersion(pack.trip.steps),
    };
    merchant = pack.merchant;
    posts = postsFromHints(pack.communityHints || []);
  } else {
    source = "fallback";
    trip = fallbackTrip();
    merchant = {
      name: "영월 동강 막국수",
      region: "영월군",
      amount: 18000,
    };
    posts = fallbackPosts();
  }

  saveTripForUser(auth.userId, trip);
  setCurrentTrip(trip);

  const regions = [
    ...new Set(trip.steps.map((s) => s.spot.region).filter(Boolean)),
  ];
  replacePassport(passportFromRegions(regions, trip.id));
  stampQuietRegionsFromTrip(trip.id, regions);

  setBenefitCtr({
    _total: 14,
    digital_resident: 5,
    gangwon_pay: 6,
    gwgs: 3,
  });

  const existing = loadCommunityPosts();
  const merged = [
    ...posts,
    ...existing.filter((p) => !p.id.startsWith("seed-")),
  ].slice(0, 30);
  saveCommunityPosts(merged);

  clearPayReceipts();
  savePayReceipt({
    merchant: merchant.name,
    region: merchant.region,
    amount: merchant.amount,
    paidAt: now,
    attachment: "데모_영수증.jpg",
    note: "심사 데모 · 강원페이 MOCK · 가맹 시드/카탈로그",
  });

  localStorage.setItem(DEMO_FLAG, "1");
  return { ok: true, userId: auth.userId, source, tripTitle: trip.title };
}

export function clearDemoSeed(): void {
  if (typeof window === "undefined") return;
  const auth = loadAuth();
  if (auth) {
    deleteTripForUser(auth.userId, DEMO_TRIP_ID);
  }
  replacePassport({
    stamps: [],
    totalQuietVisits: 0,
    updatedAt: new Date().toISOString(),
  });
  setBenefitCtr({ _total: 0 });
  clearPayReceipts();
  const posts = loadCommunityPosts().filter((p) => !p.id.startsWith("seed-"));
  saveCommunityPosts(posts);
  localStorage.removeItem(DEMO_FLAG);
  try {
    sessionStorage.removeItem("voyageai_current_trip");
  } catch {
    /* ignore */
  }
}

export function ensureCommunitySeed(): CommunityPost[] {
  const posts = loadCommunityPosts();
  if (posts.length > 0) return posts;
  const seed = fallbackPosts();
  saveCommunityPosts(seed);
  return seed;
}

export function quietRegionCount() {
  return QUIET_REGIONS.length;
}
