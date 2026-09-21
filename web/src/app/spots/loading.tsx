export default function SpotsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-4 px-4 py-8 pt-[calc(var(--nav-h)+1.5rem)] sm:px-5">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-sea-mist/80" />
      <div className="flex gap-2">
        <div className="h-8 w-20 animate-pulse rounded-full bg-white/70" />
        <div className="h-8 w-20 animate-pulse rounded-full bg-white/70" />
        <div className="h-8 w-24 animate-pulse rounded-full bg-white/70" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="min-h-[9rem] animate-pulse rounded-[var(--radius)] bg-white/70 ring-1 ring-[var(--outline)]"
          />
        ))}
      </div>
    </div>
  );
}
