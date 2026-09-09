import { notFound } from "next/navigation";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import { LeagueAwardsHistory } from "@/components/awards/LeagueAwardsHistory";
import { PageHeader } from "@/components/owner/PageHeader";
import { toAwardsHubView } from "@/state/awards-hub-selectors";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ season?: string }>;
};

export default async function AwardsPage({ params, searchParams }: PageProps) {
  const { saveId } = await params;
  const { season } = await searchParams;
  const loaded = await prismaSaveGameStore.load(saveId);
  if (!loaded) {
    notFound();
  }

  const seasonYear = season ? Number(season) : undefined;
  const hub = toAwardsHubView(
    loaded.state,
    Number.isFinite(seasonYear) ? { seasonYear } : undefined,
  );

  return (
    <>
      <PageHeader
        title="Awards"
        subtitle="League award history by season"
      />
      <LeagueAwardsHistory
        saveId={saveId}
        currentSeasonYear={hub.currentSeasonYear}
        seasons={hub.seasons}
        majorAwards={hub.majorAwards}
        monthlyAwards={hub.monthlyAwards}
        isBrowsingHistorical={hub.isBrowsingHistorical}
        selectedSeasonYear={hub.selectedSeasonYear}
      />
    </>
  );
}
