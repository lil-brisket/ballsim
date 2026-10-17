import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadLeagueHubView } from "@/application/game-service";
import { LeagueHeader } from "@/components/league/LeagueHeader";
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
import { ErrorState } from "@/components/ui/EmptyState";
import { cn, focusRingClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "League" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function LeagueHubPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadLeagueHubView(saveId);
  if (!view) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <LeagueHeader
        saveId={saveId}
        leagueName={view.leagueName}
        myTeam={view.myTeam}
        playoffBanner={view.playoffBanner}
      />
      {error ? <ErrorState message={error} /> : null}

      {view.expansionActive ? (
        <p className="text-sm text-zinc-400">
          Expansion opportunity is available.{" "}
          <Link
            href={`/dashboard/${saveId}/league/expansion`}
            className={cn(
              "text-team-ink underline-offset-4 hover:underline",
              focusRingClass,
            )}
          >
            View expansion
          </Link>
        </p>
      ) : null}

      {/* Tier 1 */}
      <LeagueSnapshotPanel
        snapshot={view.snapshot}
        cutoffTeam={view.myTeam?.cutoffTeam ?? null}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <LeagueStandingsSnapshot
          saveId={saveId}
          rows={view.standingsPreview}
          cutoffRank={view.cutoffRank}
          includesUserOutsideTop={view.standingsIncludesUserOutsideTop}
        />
        <LeagueRecentResultsPanel saveId={saveId} games={view.recentResults} />
      </div>

      {/* Tier 2 — compact previews */}
      <div className="grid gap-4 lg:grid-cols-2">
        <LeagueTransactionsBriefing saveId={saveId} rows={view.transactions} />
        <LeagueInjuriesBriefing saveId={saveId} rows={view.injuries} />
      </div>
      <LeagueMediaBriefing saveId={saveId} rows={view.media} />
    </div>
  );
}
