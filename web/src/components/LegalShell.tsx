import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell } from "@/components/ui";

const SIDE = [
  { href: "/about", label: "서비스 소개" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/terms", label: "이용약관" },
  { href: "/credits", label: "출처·라이선스" },
] as const;

export function LegalShell({
  title,
  blurb,
  activeHref,
  children,
}: {
  title: string;
  blurb: string;
  activeHref: string;
  children: ReactNode;
}) {
  return (
    <PageShell>
      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[calc(var(--nav-h)+1rem)] lg:self-start">
          <p className="m-0 text-[0.68rem] font-bold tracking-wide text-muted">운영 정보</p>
          <nav className="mt-2 flex flex-col gap-0.5" aria-label="운영 문서">
            {SIDE.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  item.href === activeHref
                    ? "rounded-[var(--radius-sm)] bg-sea px-2.5 py-2 text-[0.8rem] font-bold text-white"
                    : "rounded-[var(--radius-sm)] px-2.5 py-2 text-[0.8rem] font-semibold text-muted hover:bg-sea-mist hover:text-sea-deep"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0">
          <header className="mb-5">
            <h1 className="ui-title">{title}</h1>
            <p className="ui-sub">{blurb}</p>
          </header>
          <div className="space-y-4 text-sm leading-relaxed text-muted [&_h2]:m-0 [&_h2]:text-[0.95rem] [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-on-surface [&_strong]:text-on-surface">
            {children}
          </div>
        </article>
      </div>
    </PageShell>
  );
}
