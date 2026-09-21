import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center pt-[calc(var(--nav-h)+2rem)]">
      <p className="m-0 text-[0.72rem] font-bold tracking-wide text-sea">404</p>
      <h1 className="m-0 text-xl font-bold text-mountain-deep">페이지를 찾을 수 없어요</h1>
      <p className="m-0 max-w-sm text-sm leading-relaxed text-muted">
        주소가 바뀌었거나 잘못된 경로일 수 있어요. 홈에서 한산 코스를 다시 시작해 보세요.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link href="/" className="ui-btn ui-btn-primary">
          홈으로
        </Link>
        <Link href="/planner" className="ui-btn ui-btn-ghost">
          일정 보기
        </Link>
      </div>
    </main>
  );
}
