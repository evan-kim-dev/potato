export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4 px-4 py-8 pt-[calc(var(--nav-h)+1.5rem)] sm:px-5">
      <div className="h-8 w-28 animate-pulse rounded-lg bg-sea-mist/80" />
      <div className="h-4 w-56 animate-pulse rounded bg-white/70" />
      <div className="min-h-[12rem] animate-pulse rounded-[var(--radius)] bg-white/70 ring-1 ring-[var(--outline)]" />
      <div className="min-h-[8rem] animate-pulse rounded-[var(--radius)] bg-white/70 ring-1 ring-[var(--outline)]" />
    </div>
  );
}
