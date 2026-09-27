import { notFound } from "next/navigation";
import { loadStandingsPageView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { LeagueLeaders } from "@/components/standings/LeagueLeaders";
import { PlayoffRaceWidget } from "@/components/standings/PlayoffRaceWidget";
import { StandingsControls } from "@/components/standings/StandingsControls";
import { StandingsTable } from "@/components/standings/StandingsTable";

type StandingsPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{
    error?: string;
    view?: string | string[];
    stats?: string | string[];
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function StandingsPage({
  params,
  searchParams,
}: StandingsPageProps) {
  const { saveId } = await params;
  const query = await searchParams;
  const hub = await loadStandingsPageView(saveId, query);
  if (!hub) {
    notFound();
  }

  const { standings, leaders, playoffRace } = hub;
  const subtitle =
    standings.mode === "offseason"
      ? `${standings.seasonYear} Final Standings${
          standings.championTeamId ? " · Season complete" : ""
        }`
      : standings.mode === "playoffs"
        ? `${standings.seasonYear} Playoffs · ${standings.playoffStatus}`
        : `${standings.seasonYear} ${standings.seasonPhase}`;

  return (
    <>
      <PageHeader title="Standings" subtitle={subtitle} />
      {query.error ? <ErrorState message={query.error} /> : null}

      <StandingsControls
        saveId={saveId}
        view={standings.view}
        stats={standings.stats}
        divisionsEnabled={standings.divisionsEnabled}
        searchParams={query}
      />

      <LeagueLeaders saveId={saveId} view={leaders} />

      {standings.mode === "playoffs" ? (
        <p className="mb-3 rounded-md border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-300">
          Playoffs in progress — regular-season cutoff markers are historical
          context only.
        </p>
      ) : null}

      {standings.groups.length === 0 ? (
        <EmptyState message="No standings available." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="space-y-8">
            {standings.groups.map((group) => (
              <StandingsTable
                key={group.id}
                saveId={saveId}
                group={group}
                page={standings}
              />
            ))}
          </div>
          <PlayoffRaceWidget saveId={saveId} view={playoffRace} />
        </div>
      )}
    </>
  );
}
