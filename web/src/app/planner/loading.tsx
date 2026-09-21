export default function PlannerLoading() {
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-8 pt-[calc(var(--nav-h)+1.5rem)]">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-sea-mist/80" />
      <div className="mt-4 min-h-[20rem] animate-pulse rounded-[var(--radius)] bg-white/70 ring-1 ring-[var(--outline)]" />
    </div>
  );
}
