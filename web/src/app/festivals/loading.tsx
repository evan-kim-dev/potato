export default function FestivalsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-4 px-4 py-8 pt-[calc(var(--nav-h)+1.5rem)] sm:px-5">
      <div className="h-8 w-36 animate-pulse rounded-lg bg-sea-mist/80" />
      <div className="h-4 w-56 animate-pulse rounded bg-white/70" />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[8rem] animate-pulse rounded-[var(--radius)] bg-white/70 ring-1 ring-[var(--outline)]"
          />
        ))}
      </div>
    </div>
  );
}
