"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/about", label: "소개" },
  { href: "/community", label: "이야기" },
  { href: "/impact", label: "임팩트" },
  { href: "/passport", label: "한산 여권" },
  { href: "/admin", label: "관리" },
  { href: "/privacy", label: "개인정보" },
  { href: "/terms", label: "약관" },
  { href: "/credits", label: "출처" },
] as const;

export function AppFooter() {
  const pathname = usePathname();
  // 홈(지도)은 뷰포트 집중 — 푸터 생략
  if (pathname === "/") return null;

  return (
    <footer className="mt-auto border-t border-[var(--outline)]/60">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-5">
        <p className="m-0 text-[0.68rem] text-muted">
          한국관광공사 · 기상청 공공데이터 활용
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="운영 정보">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[0.68rem] text-muted transition hover:text-mountain-deep"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
