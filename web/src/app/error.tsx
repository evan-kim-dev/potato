"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="m-0 text-xl font-bold text-mountain-deep">잠시 문제가 생겼어요</h1>
      <p className="m-0 text-sm text-muted">
        {error.message || "페이지를 다시 불러와 주세요."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-sea px-4 py-2 text-sm font-bold text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
