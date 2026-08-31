import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { LeagueAwardsHistory } from "@/components/awards/LeagueAwardsHistory";
import { PageHeader } from "@/components/owner/PageHeader";

type PageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function AwardsPage({ params }: PageProps) {
  const { saveId } = await params;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Awards"
        subtitle="League award history by season"
      />
      <LeagueAwardsHistory
        saveId={saveId}
        seasons={view.leagueAwards.seasons}
        rows={view.leagueAwards.rows}
      />
    </>
  );
}
