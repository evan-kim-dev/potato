export default function WeatherLoading() {
  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-6 px-4 py-8 pt-[calc(var(--nav-h)+1.5rem)]">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-sea-mist/80" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-[var(--radius)] bg-white/70 ring-1 ring-[var(--outline)]"
          />
        ))}
      </div>
    </div>
  );
}
