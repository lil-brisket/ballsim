import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadLeagueTeamStatsView } from "@/application/game-service";
import { LeagueTeamStatsTable } from "@/components/league/LeagueStatsTables";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Team Stats" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ sort?: string | string[]; dir?: string | string[] }>;
};

export default async function LeagueTeamStatsPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const view = await loadLeagueTeamStatsView(saveId, await searchParams);
  if (!view) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Team Stats"
        subtitle="Regular-season per-game averages"
      />
      <LeagueTeamStatsTable saveId={saveId} view={view} />
    </>
  );
}
