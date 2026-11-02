import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadLeaguePlayerStatsView } from "@/application/game-service";
import { LeaguePlayerStatsTable } from "@/components/league/LeagueStatsTables";
import { HubPageSwitch } from "@/components/game/shell/HubPageSwitch";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Player Stats" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{
    sort?: string | string[];
    dir?: string | string[];
    show?: string | string[];
  }>;
};

export default async function LeaguePlayerStatsPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const view = await loadLeaguePlayerStatsView(saveId, await searchParams);
  if (!view) {
    notFound();
  }

  return (
    <>
      <HubPageSwitch saveId={saveId} pair="stats" active="player-stats" />
      <PageHeader
        title="Player Stats"
        subtitle={`Regular-season per-game averages · Min ${view.minGames} games${
          view.sort.key.endsWith("Pct")
            ? ` and ${view.minAttemptsPerGame} attempt per game`
            : ""
        }`}
      />
      <LeaguePlayerStatsTable saveId={saveId} view={view} />
    </>
  );
}
