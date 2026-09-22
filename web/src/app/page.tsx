import { HomeMap } from "@/components/HomeMap";
import { HomeChat } from "@/components/HomeChat";
import { QuietGems } from "@/components/QuietGems";
import { CongestionBanner } from "@/components/CongestionBanner";
import { ReviewHint } from "@/components/ReviewHint";
import { getQuietGems, getRegionTipsMap } from "@/lib/data";
import { Suspense } from "react";

export default function HomePage() {
  const tips = getRegionTipsMap();
  const gems = getQuietGems(8);

  return (
    <main className="home-shell home-shell--viewport relative overflow-hidden pt-[var(--nav-h)]">
      <div className="home-stage mx-auto grid h-[calc(100dvh-var(--nav-h))] w-full max-w-[1280px] grid-cols-1 grid-rows-[minmax(14rem,58%)_minmax(0,1fr)] gap-2 px-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(300px,380px)] sm:grid-rows-1 sm:gap-4 sm:px-4 md:gap-5 md:px-5 lg:gap-6 lg:px-6">
        <section className="home-map-col relative flex min-h-0 min-w-0 flex-col overflow-hidden py-2 sm:py-3">
          <header className="home-intro home-intro--compact shrink-0">
            <h1 className="home-title">
              <span className="home-title-brand">강원 온도</span>
              <span className="home-title-sep" aria-hidden>
                ·
              </span>
              한산한 강원을 먼저
            </h1>
          </header>
          <ReviewHint />
          <CongestionBanner tips={tips} />
          <div className="home-map-wrap flex min-h-0 flex-1 flex-col items-center justify-center">
            <HomeMap tips={tips} compact />
          </div>
          <div className="home-gems-slot mt-2 min-h-0 shrink-0 sm:mt-2.5">
            <QuietGems gems={gems} />
          </div>
        </section>

        <aside className="home-aside flex min-h-0 flex-col overflow-hidden border-t border-[var(--outline)]/70 sm:border-t-0 sm:py-3">
          <Suspense
            fallback={
              <div className="ui-panel h-full min-h-0 flex-1 animate-pulse" aria-hidden />
            }
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <HomeChat />
            </div>
          </Suspense>
        </aside>
      </div>
    </main>
  );
}
