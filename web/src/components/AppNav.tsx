"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAuth, loadAuth, loginLocal, type AuthSession } from "@/lib/storage";

const TABS = [
  { href: "/", label: "홈" },
  { href: "/planner", label: "일정" },
  { href: "/spots", label: "명소" },
  { href: "/festivals", label: "축제" },
  { href: "/weather", label: "날씨" },
  { href: "/community", label: "이야기" },
  { href: "/passport", label: "여권" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [open, setOpen] = useState(false);
  const [nick, setNick] = useState("");

  useEffect(() => {
    setAuth(loadAuth());
    setOpen(false);
    setNick("");
  }, [pathname]);

  function doLogin() {
    const name = nick.trim();
    if (name.length < 2 || name.length > 12) return;
    setAuth(loginLocal(name));
    setNick("");
    setOpen(false);
  }

  function doLogout() {
    clearAuth();
    setAuth(null);
    setOpen(false);
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-[var(--nav-h)] border-b border-[var(--outline)]/50 bg-[rgba(247,250,249,0.82)] backdrop-blur-md">
      <div className="mx-auto grid h-full max-w-[1120px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-5">
        <Link href="/" className="inline-flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/mascot-icon.png"
            alt=""
            className="h-7 w-7 rounded-[0.45rem] object-contain"
          />
          <span className="brand-wordmark truncate text-[1.12rem] font-semibold tracking-[-0.03em] text-mountain-deep">
            강원 온도
          </span>
        </Link>

        <nav
          className="flex items-center justify-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="주요 메뉴"
        >
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={
                  active
                    ? "px-2.5 py-1.5 text-[0.78rem] font-semibold text-mountain-deep"
                    : "px-2.5 py-1.5 text-[0.78rem] font-medium text-muted transition hover:text-mountain-deep"
                }
                aria-current={active ? "page" : undefined}
              >
                <span
                  className={
                    active
                      ? "border-b-2 border-sea pb-0.5"
                      : "border-b-2 border-transparent pb-0.5"
                  }
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="relative justify-self-end">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-2 px-1 py-1 text-[0.75rem] font-medium text-mountain-deep/80 transition hover:text-mountain-deep"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mountain-soft text-[0.7rem] font-semibold text-mountain-deep">
              {(auth?.name || "G").slice(0, 1)}
            </span>
            <span className="hidden sm:inline">{auth?.name || "로그인"}</span>
          </button>
          {open && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default bg-transparent"
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
              />
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-[var(--radius)] border border-[var(--outline)] bg-white p-2 shadow-[var(--shadow-md)]">
                <p className="px-2 py-1.5 text-[0.68rem] text-muted">
                  {auth ? auth.name : "게스트"}
                </p>
                <Link
                  href="/trips"
                  onClick={() => setOpen(false)}
                  className="block rounded-[var(--radius-sm)] px-2 py-2 text-[0.8rem] font-medium hover:bg-sea-mist"
                >
                  찜한 일정
                </Link>
                <Link
                  href="/passport"
                  onClick={() => setOpen(false)}
                  className="block rounded-[var(--radius-sm)] px-2 py-2 text-[0.8rem] font-medium hover:bg-sea-mist"
                >
                  한산 여권
                </Link>
                <Link
                  href="/impact"
                  onClick={() => setOpen(false)}
                  className="block rounded-[var(--radius-sm)] px-2 py-2 text-[0.8rem] font-medium hover:bg-sea-mist"
                >
                  임팩트
                </Link>
                <Link
                  href="/about"
                  onClick={() => setOpen(false)}
                  className="block rounded-[var(--radius-sm)] px-2 py-2 text-[0.8rem] font-medium hover:bg-sea-mist"
                >
                  소개
                </Link>
                <div className="my-1 border-t border-[var(--outline)]" />
                {auth ? (
                  <button
                    type="button"
                    onClick={doLogout}
                    className="w-full rounded-[var(--radius-sm)] px-2 py-2 text-left text-[0.8rem] font-medium text-muted hover:bg-sea-mist"
                  >
                    로그아웃
                  </button>
                ) : (
                  <div className="space-y-2 px-1 py-1">
                    <input
                      value={nick}
                      onChange={(e) => setNick(e.target.value)}
                      maxLength={12}
                      placeholder="닉네임 2~12자"
                      className="ui-field !py-1.5"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") doLogin();
                      }}
                    />
                    <button
                      type="button"
                      onClick={doLogin}
                      className="ui-btn ui-btn-primary w-full"
                    >
                      시작하기
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
