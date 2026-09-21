import { FestivalsBoard } from "@/components/FestivalsBoard";
import { PageShell } from "@/components/ui";
import { getFestivals } from "@/lib/data";

export default function FestivalsPage() {
  return (
    <PageShell>
      <FestivalsBoard festivals={getFestivals()} />
    </PageShell>
  );
}
