import Link from "next/link";
import { notFound } from "next/navigation";
import { loadLeagueHubView } from "@/application/game-service";
import { LeagueHeader, MyTeamContextStrip } from "@/components/league/LeagueHeader";
import {
  LeagueSnapshotPanel,
  LeagueStandingsSnapshot,
} from "@/components/league/LeagueTier1Panels";
import {
  LeagueInjuriesBriefing,
  LeagueMediaBriefing,
  LeagueRecentResultsPanel,
  LeagueTransactionsBriefing,
} from "@/components/league/LeagueTier2Panels";
import { ErrorState } from "@/components/owner/EmptyState";
import { cn, focusRingClass } from "@/components/ui/styles";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function LeagueHubPage({ params, searchParams }: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadLeagueHubView(saveId);
  if (!view) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <LeagueHeader
        leagueName={view.leagueName}
        seasonYear={view.seasonYear}
        seasonPhaseLabel={view.seasonPhaseLabel}
        currentDate={view.currentDate}
        userTeamLabel={`${view.userTeamCity} ${view.userTeamName}`}
        playoffBanner={view.playoffBanner}
      />
      {error ? <ErrorState message={error} /> : null}

      {view.myTeam ? (
        <MyTeamContextStrip
          saveId={saveId}
          teamId={view.myTeam.teamId}
          city={view.myTeam.city}
          name={view.myTeam.name}
          abbreviation={view.myTeam.abbreviation}
          wins={view.myTeam.wins}
          losses={view.myTeam.losses}
          conferenceRank={view.myTeam.conferenceRank}
          conferenceName={view.myTeam.conferenceName}
          gamesBack={view.myTeam.gamesBack}
          streakLabel={view.myTeam.streakLabel}
          leagueLeader={view.myTeam.leagueLeader}
          cutoffTeam={view.myTeam.cutoffTeam}
        />
      ) : null}

      {view.expansionActive ? (
        <p className="text-sm text-zinc-400">
          Expansion opportunity is available.{" "}
          <Link
            href={`/dashboard/${saveId}/league/expansion`}
            className={cn("text-amber-400 hover:text-amber-300", focusRingClass)}
          >
            View expansion
          </Link>
        </p>
      ) : null}

      {/* Tier 1 */}
      <LeagueSnapshotPanel snapshot={view.snapshot} />
      <div className="grid gap-4 lg:grid-cols-2">
        <LeagueStandingsSnapshot
          saveId={saveId}
          rows={view.standingsPreview}
          cutoffRank={view.cutoffRank}
          includesUserOutsideTop={view.standingsIncludesUserOutsideTop}
        />
        <LeagueRecentResultsPanel
          saveId={saveId}
          games={view.recentResults}
        />
      </div>

      {/* Tier 2 — compact previews */}
      <div className="grid gap-4 lg:grid-cols-2">
        <LeagueTransactionsBriefing
          saveId={saveId}
          rows={view.transactions}
        />
        <LeagueInjuriesBriefing saveId={saveId} rows={view.injuries} />
      </div>
      <LeagueMediaBriefing saveId={saveId} rows={view.media} />
    </div>
  );
}
