import { PassportBoard } from "@/components/ImpactPassportBoards";

export default function PassportPage() {
  return (
    <main className="mx-auto max-w-[820px] px-4 pb-16 pt-[calc(var(--nav-h)+1.25rem)] sm:px-5">
      <PassportBoard />
    </main>
  );
}
