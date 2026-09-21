import { TripsBoard } from "@/components/TripsBoard";
import { PageShell } from "@/components/ui";

export default function TripsPage() {
  return (
    <PageShell narrow>
      <TripsBoard />
    </PageShell>
  );
}
