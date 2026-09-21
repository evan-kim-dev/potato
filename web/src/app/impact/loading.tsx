export default function ImpactLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-4 px-4 py-8">
      <div className="h-8 w-48 rounded bg-mountain-soft/60" />
      <div className="h-4 w-full max-w-md rounded bg-mountain-soft/40" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-[var(--radius)] bg-white/80" />
        ))}
      </div>
    </div>
  );
}
