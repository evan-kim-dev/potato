import type { LocalBenefit } from "@/lib/benefits";
import { trackBenefitClick } from "@/lib/benefits";

export function LocalBenefits({ benefit }: { benefit: LocalBenefit }) {
  return (
    <aside className="rounded-[var(--radius)] border border-mountain/15 bg-white/90 px-3.5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-[0.68rem] font-bold tracking-wide text-mountain">로컬 혜택</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {benefit.links.slice(0, 3).map((l) => (
            <a
              key={l.href + l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackBenefitClick(l.id || l.label)}
              className="text-[0.7rem] font-semibold text-sea underline-offset-2 hover:underline"
              data-cta={l.id || "benefit"}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>
      <strong className="mt-1 block text-[0.88rem] font-bold text-mountain-deep">
        {benefit.title}
      </strong>
      <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">{benefit.body}</p>
      <p className="mt-2 m-0 text-[0.68rem] text-muted">
        혜택 탭은{" "}
        <a href="/impact" className="font-semibold text-sea hover:underline">
          임팩트 KPI
        </a>
        의 클릭 지표에 반영돼요.
      </p>
    </aside>
  );
}
