export default function CommunityLoading() {
  return (
    <div className="mx-auto w-full max-w-[720px] space-y-4 px-4 py-8 pt-[calc(var(--nav-h)+1.5rem)] sm:px-5">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-sea-mist/80" />
      <div className="flex gap-2">
        <div className="h-8 w-16 animate-pulse rounded-full bg-white/70" />
        <div className="h-8 w-16 animate-pulse rounded-full bg-white/70" />
      </div>
      <div className="min-h-[10rem] animate-pulse rounded-[var(--radius)] bg-white/70 ring-1 ring-[var(--outline)]" />
      <div className="min-h-[8rem] animate-pulse rounded-[var(--radius)] bg-white/70 ring-1 ring-[var(--outline)]" />
    </div>
  );
}
