import Link from "next/link";
import { notFound } from "next/navigation";
import { executeTradeAction } from "@/application/actions";
import { loadOwnerPlayerView } from "@/application/game-service";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { PlayerAttributesPanel } from "@/components/player-profile/PlayerAttributes";
import { PlayerCareer } from "@/components/player-profile/PlayerCareer";
import { PlayerContract } from "@/components/player-profile/PlayerContract";
import { PlayerGameLog } from "@/components/player-profile/PlayerGameLog";
import { PlayerOverview } from "@/components/player-profile/PlayerOverview";
import { PlayerProfileHeader } from "@/components/player-profile/PlayerProfileHeader";
import {
  isPlayerProfileTab,
  PlayerProfileNav,
  type PlayerProfileTab,
} from "@/components/player-profile/PlayerProfileNav";
import { PlayerStats } from "@/components/player-profile/PlayerStats";
import { PlayerTrends } from "@/components/player-profile/PlayerTrends";
import { DevelopmentLeaguePlayerActions } from "@/components/player-profile/DevelopmentLeaguePlayerActions";

type PlayerPageProps = {
  params: Promise<{ saveId: string; playerId: string }>;
  searchParams: Promise<{ error?: string; tab?: string }>;
};

export default async function PlayerDetailPage({
  params,
  searchParams,
}: PlayerPageProps) {
  const { saveId, playerId } = await params;
  const { error, tab: tabParam } = await searchParams;
  const view = await loadOwnerPlayerView(saveId, playerId);
  if (!view) {
    notFound();
  }

  const { player, dashboard } = view;
  const returnPath = `/dashboard/${saveId}/players/${playerId}`;
  const canTrade =
    player.onControlledRoster &&
    (dashboard.seasonPhase === "regular" ||
      dashboard.seasonPhase === "preseason");

  const activeTab: PlayerProfileTab =
    tabParam && isPlayerProfileTab(tabParam) ? tabParam : "overview";

  const tradeActions = canTrade ? (
    <Section title="Actions">
      <ConfirmDialog
        title="Execute trade"
        description="Find and execute the first acceptable 1-for-1 trade for this player using the canonical trade system."
        confirmLabel="Trade"
      >
        <form action={executeTradeAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="outgoingPlayerId" value={playerId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button
            type="submit"
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            Confirm trade
          </button>
        </form>
      </ConfirmDialog>
    </Section>
  ) : null;

  return (
    <>
      <PageHeader
        title={`${player.firstName} ${player.lastName}`}
        subtitle="Player profile"
        actions={
          <Link
            href={`/dashboard/${saveId}/roster`}
            className="text-sm text-zinc-400 hover:text-amber-400"
          >
            ← Roster
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="space-y-4">
        <PlayerProfileHeader player={player} />
        <PlayerProfileNav
          saveId={saveId}
          playerId={playerId}
          activeTab={activeTab}
        />

        {activeTab === "overview" ? (
          <>
            <DevelopmentLeaguePlayerActions
              saveId={saveId}
              playerId={playerId}
              returnPath={returnPath}
              canAssign={player.developmentLeague.canAssign}
              canRecall={player.developmentLeague.canRecall}
              statusLabel={player.developmentLeague.statusLabel}
              readinessLabel={player.developmentLeague.readinessLabel}
              whyBullets={player.developmentLeague.whyBullets}
            />
            <PlayerOverview player={player} actions={tradeActions} />
          </>
        ) : null}
        {activeTab === "attributes" ? (
          <PlayerAttributesPanel player={player} />
        ) : null}
        {activeTab === "stats" ? <PlayerStats player={player} /> : null}
        {activeTab === "trends" ? <PlayerTrends player={player} /> : null}
        {activeTab === "gamelog" ? (
          <PlayerGameLog player={player} saveId={saveId} />
        ) : null}
        {activeTab === "career" ? (
          <PlayerCareer player={player} saveId={saveId} />
        ) : null}
        {activeTab === "contract" ? (
          <PlayerContract player={player} saveId={saveId} />
        ) : null}
      </div>
    </>
  );
}
