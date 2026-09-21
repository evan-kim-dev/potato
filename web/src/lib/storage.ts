export type AuthSession = {
  loggedIn: boolean;
  name: string;
  userId: string;
  provider: "local" | "google" | "kakao";
  email?: string;
};

export type CommunityPost = {
  id: string;
  type: "review" | "question" | "tip";
  author: string;
  authorId: string;
  region: string;
  title: string;
  body: string;
  tags: string[];
  likes: number;
  createdAt: string;
  aiPrompt: string;
};

export type CommunityComment = {
  id: string;
  postId: string;
  author: string;
  authorId: string;
  body: string;
  createdAt: string;
};

const AUTH_KEY = "voyageai_auth_session";
const TRIPS_KEY = "voyageai_saved_trips";
const CURRENT_TRIP_KEY = "voyageai_current_trip";
const POSTS_KEY = "voyageai_community_posts";
const COMMENTS_KEY = "voyageai_community_comments";
const LIKES_KEY = "voyageai_community_likes";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadAuth(): AuthSession | null {
  const s = readJson<AuthSession | null>(AUTH_KEY, null);
  return s?.loggedIn ? s : null;
}

export function saveAuth(session: AuthSession) {
  writeJson(AUTH_KEY, session);
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export function loginLocal(name: string): AuthSession {
  const nick = name.trim().slice(0, 12);
  const session: AuthSession = {
    loggedIn: true,
    name: nick,
    userId: `local:${nick}`,
    provider: "local",
  };
  saveAuth(session);
  return session;
}

export function loadSavedTrips(userId: string) {
  const all = readJson<Record<string, unknown[]>>(TRIPS_KEY, {});
  return (all[userId] || []) as import("@/lib/tripTypes").TripPlan[];
}

export function saveTripForUser(userId: string, trip: import("@/lib/tripTypes").TripPlan) {
  const all = readJson<Record<string, import("@/lib/tripTypes").TripPlan[]>>(TRIPS_KEY, {});
  const list = [trip, ...(all[userId] || []).filter((t) => t.id !== trip.id)].slice(0, 30);
  all[userId] = list;
  writeJson(TRIPS_KEY, all);
  return list;
}

export function deleteTripForUser(userId: string, tripId: string) {
  const all = readJson<Record<string, import("@/lib/tripTypes").TripPlan[]>>(TRIPS_KEY, {});
  all[userId] = (all[userId] || []).filter((t) => t.id !== tripId);
  writeJson(TRIPS_KEY, all);
  return all[userId];
}

export function setCurrentTrip(trip: import("@/lib/tripTypes").TripPlan) {
  sessionStorage.setItem(CURRENT_TRIP_KEY, JSON.stringify(trip));
}

export function getCurrentTrip(): import("@/lib/tripTypes").TripPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CURRENT_TRIP_KEY);
    return raw ? (JSON.parse(raw) as import("@/lib/tripTypes").TripPlan) : null;
  } catch {
    return null;
  }
}

export function loadCommunityPosts(): CommunityPost[] {
  return readJson<CommunityPost[]>(POSTS_KEY, []);
}

export function saveCommunityPosts(posts: CommunityPost[]) {
  writeJson(POSTS_KEY, posts.slice(0, 30));
}

export function loadCommunityComments(): CommunityComment[] {
  return readJson(COMMENTS_KEY, []);
}

export function saveCommunityComments(comments: CommunityComment[]) {
  writeJson(COMMENTS_KEY, comments.slice(0, 500));
}

export function loadCommunityLikes(): string[] {
  return readJson(LIKES_KEY, []);
}

export function saveCommunityLikes(ids: string[]) {
  writeJson(LIKES_KEY, ids);
}
