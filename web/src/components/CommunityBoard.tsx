"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  loadAuth,
  loadCommunityComments,
  loadCommunityLikes,
  loginLocal,
  saveCommunityComments,
  saveCommunityLikes,
  saveCommunityPosts,
  type AuthSession,
  type CommunityComment,
  type CommunityPost,
} from "@/lib/storage";
import { QUIET_REGIONS } from "@/lib/prefs";
import { Button, Chip, PageHeader } from "@/components/ui";
import { ensureCommunitySeed } from "@/lib/demoSeed";

const FILTERS = [
  { id: "all", label: "전체" },
  { id: "review", label: "후기" },
  { id: "question", label: "질문" },
  { id: "tip", label: "팁" },
] as const;

const REGION_OPTIONS = ["강원", ...QUIET_REGIONS] as const;

export function CommunityBoard() {
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [likes, setLikes] = useState<string[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [regionFilter, setRegionFilter] = useState("전체");
  const [type, setType] = useState<CommunityPost["type"]>("review");
  const [postRegion, setPostRegion] = useState<string>("영월군");
  const [body, setBody] = useState("");
  const [nickDraft, setNickDraft] = useState("");
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    setAuth(loadAuth());
    setPosts(ensureCommunitySeed());
    setComments(loadCommunityComments());
    setLikes(loadCommunityLikes());
  }, []);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (filter !== "all" && p.type !== filter) return false;
      if (regionFilter !== "전체" && p.region !== regionFilter) return false;
      return true;
    });
  }, [posts, filter, regionFilter]);

  function ensureAuth() {
    if (auth) {
      setAuthError("");
      return auth;
    }
    const nick = nickDraft.trim();
    if (nick.length < 2 || nick.length > 12) {
      setAuthError("닉네임 2~12자를 입력해 주세요");
      return null;
    }
    const session = loginLocal(nick);
    setAuth(session);
    setNickDraft("");
    setAuthError("");
    return session;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const session = ensureAuth();
    if (!session) return;
    const text = body.trim();
    if (!text) return;
    const post: CommunityPost = {
      id: `user-${Date.now()}`,
      type,
      author: session.name,
      authorId: session.userId,
      region: postRegion,
      title: text.slice(0, 40),
      body: text,
      tags: [type, postRegion],
      likes: 0,
      createdAt: new Date().toISOString(),
      aiPrompt: `${postRegion} ${text.slice(0, 60)} 비슷한 한산 권역 여행 코스 추천해줘`,
    };
    const next = [post, ...posts].slice(0, 40);
    setPosts(next);
    saveCommunityPosts(next);
    setBody("");
  }

  function toggleLike(id: string) {
    const session = ensureAuth();
    if (!session) return;
    const liked = likes.includes(id);
    const nextLikes = liked ? likes.filter((x) => x !== id) : [...likes, id];
    setLikes(nextLikes);
    saveCommunityLikes(nextLikes);
    const nextPosts = posts.map((p) =>
      p.id === id ? { ...p, likes: Math.max(0, p.likes + (liked ? -1 : 1)) } : p
    );
    setPosts(nextPosts);
    saveCommunityPosts(nextPosts);
  }

  function addComment(postId: string) {
    const session = ensureAuth();
    if (!session) return;
    const text = commentDraft.trim();
    if (!text) return;
    const c: CommunityComment = {
      id: `c-${Date.now()}`,
      postId,
      author: session.name,
      authorId: session.userId,
      body: text,
      createdAt: new Date().toISOString(),
    };
    const next = [c, ...comments].slice(0, 500);
    setComments(next);
    saveCommunityComments(next);
    setCommentDraft("");
  }

  return (
    <div>
      <PageHeader
        title="한산 권역 이야기"
        sub="후기·질문·팁 · 이 기기에 저장"
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Chip key={f.id} on={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Chip on={regionFilter === "전체"} onClick={() => setRegionFilter("전체")}>
          전체 시군
        </Chip>
        {QUIET_REGIONS.map((r) => (
          <Chip key={r} on={regionFilter === r} onClick={() => setRegionFilter(r)}>
            {r.replace(/(시|군)$/, "")}
          </Chip>
        ))}
      </div>

      <form onSubmit={onSubmit} className="ui-panel mb-4 space-y-2 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[0.75rem] font-semibold text-muted">
            {auth ? `${auth.name}님` : "게스트 · 아래에 닉네임 후 게시"}
          </span>
          <div className="flex flex-wrap gap-2">
            <select
              value={postRegion}
              onChange={(e) => setPostRegion(e.target.value)}
              className="ui-field !w-auto !py-1"
              aria-label="권역"
            >
              {REGION_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CommunityPost["type"])}
              className="ui-field !w-auto !py-1"
              aria-label="글 종류"
            >
              <option value="review">후기</option>
              <option value="question">질문</option>
              <option value="tip">팁</option>
            </select>
          </div>
        </div>
        {!auth && (
          <input
            value={nickDraft}
            onChange={(e) => setNickDraft(e.target.value)}
            maxLength={12}
            placeholder="닉네임 (2~12자)"
            className="ui-field"
            aria-label="닉네임"
          />
        )}
        {authError ? (
          <p className="m-0 text-[0.75rem] text-red-700">{authError}</p>
        ) : null}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="한산 권역 경험, 분산 팁, 궁금한 점을 공유해 주세요…"
          className="ui-field resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-[0.7rem] text-muted">{body.length} / 500</span>
          <Button type="submit">게시하기</Button>
        </div>
      </form>

      <div className="space-y-3">
        {filtered.map((p) => {
          const pcs = comments.filter((c) => c.postId === p.id);
          return (
            <article key={p.id} className="ui-panel p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="ui-badge-sea ui-badge">
                    {p.type === "review" ? "후기" : p.type === "question" ? "질문" : "팁"}
                  </span>
                  <span className="rounded bg-mountain-soft px-1.5 py-0.5 text-[0.62rem] font-bold text-mountain-deep">
                    {p.region}
                  </span>
                </div>
                <span className="text-[0.7rem] text-muted">
                  {p.author} · {new Date(p.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{p.body}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.75rem]">
                <button type="button" onClick={() => toggleLike(p.id)} className="font-semibold text-sea">
                  {likes.includes(p.id) ? "♥" : "♡"} {p.likes}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenComments(openComments === p.id ? null : p.id)}
                  className="font-semibold text-muted"
                >
                  댓글 {pcs.length}
                </button>
                <a href={`/?ask=${encodeURIComponent(p.aiPrompt)}`} className="ui-link">
                  AI 코스 →
                </a>
              </div>
              {openComments === p.id && (
                <div className="mt-3 space-y-2 border-t border-[var(--outline)] pt-3">
                  {pcs.map((c) => (
                    <p key={c.id} className="text-[0.78rem] text-muted">
                      <strong className="text-on-surface">{c.author}</strong> {c.body}
                    </p>
                  ))}
                  {!auth && (
                    <input
                      value={nickDraft}
                      onChange={(e) => setNickDraft(e.target.value)}
                      maxLength={12}
                      placeholder="댓글용 닉네임"
                      className="ui-field !py-1.5"
                    />
                  )}
                  <div className="flex gap-2">
                    <input
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder="댓글 입력"
                      className="ui-field min-w-0 flex-1 !py-1.5"
                    />
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => addComment(p.id)}
                      className="!bg-mountain !text-white hover:!bg-mountain-deep"
                    >
                      등록
                    </Button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      {!filtered.length && (
        <div className="ui-empty text-center">
          <p className="m-0 text-sm text-muted">조건에 맞는 글이 없어요.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button
              variant="secondary"
              className="!min-h-8 !text-[0.75rem]"
              onClick={() => {
                setFilter("all");
                setRegionFilter("전체");
              }}
            >
              전체 보기
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
