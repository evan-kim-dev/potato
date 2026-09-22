import { QUIET_REGIONS } from "@/lib/prefs";
import {
  loadAuth,
  loginLocal,
  loadCommunityPosts,
  saveCommunityPosts,
  saveTripForUser,
  deleteTripForUser,
  type CommunityPost,
} from "@/lib/storage";
import type { TripPlan } from "@/lib/tripTypes";
import { replacePassport, type QuietPassport } from "@/lib/passport";
import { setBenefitCtr } from "@/lib/benefits";
import { clearPayReceipts, savePayReceipt } from "@/lib/payReceipts";

const DEMO_FLAG = "gw_demo_seed_v1";
const DEMO_USER = "심사데모";

const SEED_POSTS: CommunityPost[] = [
  {
    id: "seed-review-yeongwol",
    type: "review",
    author: "한산여행러",
    authorId: "seed:han",
    region: "영월군",
    title: "청령포 한산 코스 추천",
    body: "속초 대신 영월로 갔어요. 동강 따라 걷고 막국수까지 — 사람이 적어 여유로웠습니다.",
    tags: ["한산", "영월", "당일"],
    likes: 12,
    createdAt: "2026-09-18T10:00:00.000Z",
    aiPrompt: "영월 청령포 당일 한산 코스",
  },
  {
    id: "seed-tip-jeongseon",
    type: "tip",
    author: "온도입문자",
    authorId: "seed:ondoh",
    region: "정선군",
    title: "정선·태백 1박 팁",
    body: "아리랑 시장 들렀다가 태백산 쪽으로 이어가면 동선이 짧아요. 강원페이 가맹도 많았습니다.",
    tags: ["정선", "태백", "강원페이"],
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
    title: "인제 자작나무 주차 어때요?",
    body: "주말에 갈 건데 혼잡할까요? 양구·인제 한산 우회 코스로 짜고 싶어요.",
    tags: ["인제", "질문"],
    likes: 3,
    createdAt: "2026-09-20T09:15:00.000Z",
    aiPrompt: "속초 대신 인제 양구 한산 코스",
  },
  {
    id: "seed-tip-yanggu",
    type: "tip",
    author: "로컬체류",
    authorId: "seed:local",
    region: "양구군",
    title: "파로호 주변 한산 스팟",
    body: "해안 핫플이 붐빌 때 양구·화천으로 오면 여유롭습니다. 관광주민증 혜택도 확인해 보세요.",
    tags: ["양구", "분산"],
    likes: 6,
    createdAt: "2026-09-21T11:00:00.000Z",
    aiPrompt: "양구 화천 한산 당일",
  },
];

function demoTrip(): TripPlan {
  const id = "demo-trip-quiet-cluster";
  const now = new Date().toISOString();
  return {
    id,
    query: "정선·영월 당일 한산 코스",
    savedAt: now,
    title: "정선·영월 한산 클러스터",
    summary: "해안 대신 내륙 인구감소 권역을 이은 저밀도 당일 코스 (심사 데모)",
    duration: "당일",
    source: "demo-seed",
    stopNames: ["정선 아리랑 마을", "영월 청령포", "동강전망공원"],
    mode: "car",
    dispersion: {
      score: 86,
      grade: "A",
      label: "저밀도 우수",
      quietRatio: 1,
      quietStops: 3,
      totalStops: 3,
      adjacentLegs: 2,
      totalLegs: 2,
      coastalHotStops: 0,
      esgNote: "한산 권역만 · 인접 동선",
    },
    steps: [
      {
        order: 1,
        day: 1,
        stay: 90,
        why: "한산 권역 문화 스팟",
        spot: {
          name: "정선 아리랑 마을",
          region: "정선군",
          description: "정선 한산 권역 대표 스팟",
          lat: 37.3808,
          lng: 128.6608,
          theme: "문화",
        },
      },
      {
        order: 2,
        day: 1,
        stay: 80,
        why: "인접 영월로 이어지는 역사·자연",
        spot: {
          name: "영월 청령포",
          region: "영월군",
          description: "단종 유배지 · 한산 체류",
          lat: 37.1765,
          lng: 128.4452,
          theme: "역사",
        },
      },
      {
        order: 3,
        day: 1,
        stay: 60,
        why: "동강 조망 · 체류 마무리",
        spot: {
          name: "동강전망공원",
          region: "영월군",
          description: "동강 뷰 포인트",
          lat: 37.1834,
          lng: 128.461,
          theme: "자연",
        },
      },
    ],
  };
}

function demoPassport(): QuietPassport {
  const now = new Date().toISOString();
  const regions = ["정선군", "영월군", "태백시", "인제군"] as const;
  return {
    stamps: regions.map((region) => ({
      region,
      short: region.replace(/(시|군)$/, ""),
      count: region === "영월군" ? 2 : 1,
      firstAt: now,
      lastAt: now,
      tripIds: ["demo-trip-quiet-cluster"],
    })),
    totalQuietVisits: 5,
    updatedAt: now,
  };
}

export function isDemoSeeded(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEMO_FLAG) === "1";
}

/** 심사 데모용 일정·여권·CTR·커뮤니티·영수증 시드 */
export function applyDemoSeed(): { ok: true; userId: string } {
  const auth = loadAuth() || loginLocal(DEMO_USER);
  const trip = demoTrip();
  saveTripForUser(auth.userId, trip);
  replacePassport(demoPassport());
  setBenefitCtr({
    _total: 14,
    digital_resident: 5,
    gangwon_pay: 6,
    gwgs: 3,
  });
  const existing = loadCommunityPosts();
  const merged = [
    ...SEED_POSTS,
    ...existing.filter((p) => !SEED_POSTS.some((s) => s.id === p.id)),
  ].slice(0, 30);
  saveCommunityPosts(merged);

  clearPayReceipts();
  savePayReceipt({
    merchant: "영월 동강 막국수",
    region: "영월군",
    amount: 18000,
    paidAt: new Date().toISOString(),
    attachment: "데모_영수증.jpg",
    note: "심사 데모 · 강원페이 MOCK",
  });

  localStorage.setItem(DEMO_FLAG, "1");
  return { ok: true, userId: auth.userId };
}

/** 데모 시드 관련 데이터 정리 */
export function clearDemoSeed(): void {
  if (typeof window === "undefined") return;
  const auth = loadAuth();
  if (auth) {
    deleteTripForUser(auth.userId, "demo-trip-quiet-cluster");
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
}

/** 커뮤니티가 비어 있을 때만 시드 글 주입 */
export function ensureCommunitySeed(): CommunityPost[] {
  const posts = loadCommunityPosts();
  if (posts.length > 0) return posts;
  saveCommunityPosts(SEED_POSTS);
  return SEED_POSTS;
}

export function quietRegionCount() {
  return QUIET_REGIONS.length;
}
