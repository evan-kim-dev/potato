export default function PassportLoading() {
  return (
    <div className="mx-auto max-w-[820px] space-y-4 px-4 pb-16 pt-[calc(var(--nav-h)+1.25rem)] sm:px-5">
      <div className="h-7 w-36 animate-pulse rounded-md bg-sea-mist/80" />
      <div className="h-4 w-64 animate-pulse rounded bg-white/70" />
      <div className="h-28 animate-pulse rounded-[var(--radius)] bg-white/80 ring-1 ring-[var(--outline)]" />
      <div className="min-h-[16rem] animate-pulse rounded-[var(--radius)] bg-white/80 ring-1 ring-[var(--outline)]" />
      <div className="min-h-[12rem] animate-pulse rounded-[var(--radius)] bg-white/80 ring-1 ring-[var(--outline)]" />
    </div>
  );
}
