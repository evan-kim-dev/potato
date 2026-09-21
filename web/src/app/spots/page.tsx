import { SpotsBoard } from "@/components/SpotsBoard";
import { PageShell } from "@/components/ui";
import { getSpots, getThemes } from "@/lib/data";

export default function SpotsPage() {
  const spots = getSpots();
  const themes = getThemes(spots);
  return (
    <PageShell>
      <SpotsBoard spots={spots} themes={themes} />
    </PageShell>
  );
}
