export default function RootLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-4 px-4 py-8 pt-[calc(var(--nav-h)+1.5rem)]">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-sea-mist/80" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-h-[16rem] animate-pulse rounded-[var(--radius)] bg-white/70 ring-1 ring-[var(--outline)]" />
        <div className="min-h-[16rem] animate-pulse rounded-[var(--radius)] bg-white/70 ring-1 ring-[var(--outline)]" />
      </div>
    </div>
  );
}
