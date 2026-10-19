import { buttonClass } from "@/components/ui/Button";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ARCHETYPE_LABELS,
  type PlayerArchetype,
} from "@/domain/entities/player-archetype";
import { executeTradeAction } from "@/application/actions";
import { loadOwnerPlayerView } from "@/application/game-service";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { PlayerAttributesPanel } from "@/components/player-profile/PlayerAttributes";
import { PlayerCareer } from "@/components/player-profile/PlayerCareer";
import { PlayerContract } from "@/components/player-profile/PlayerContract";
import { PlayerGameLog } from "@/components/player-profile/PlayerGameLog";
import { PlayerOverview } from "@/components/player-profile/PlayerOverview";
import { PlayerAttributeTrends } from "@/components/player-profile/PlayerAttributeTrends";
import {
  PlayerProfileNav,
  resolvePlayerProfileTab,
  type PlayerProfileTab,
} from "@/components/player-profile/PlayerProfileNav";
import { PlayerProfileSummary } from "@/components/player-profile/PlayerProfileSummary";
import { DevelopmentTab } from "@/components/basketball/player-card/DevelopmentTab";
import { StatisticsTab } from "@/components/basketball/player-card/StatisticsTab";
import { PlayerProfileHero } from "@/components/basketball/PlayerProfileHero";
import { DevelopmentLeaguePlayerActions } from "@/components/player-profile/DevelopmentLeaguePlayerActions";

export const metadata: Metadata = { title: "Player" };

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
  const canTrade = player.onControlledRoster && dashboard.tradesOpen;

  const activeTab: PlayerProfileTab = resolvePlayerProfileTab(tabParam);
  const archetypeLabel =
    ARCHETYPE_LABELS[player.archetype as PlayerArchetype] ?? player.archetype;

  const tradeActions = canTrade ? (
    <Section title="Actions">
      <ConfirmDialog
        title="Execute trade"
        description="Find and execute the first acceptable trade for this player. Does not trade a different roster player."
        confirmLabel="Trade"
      >
        <form action={executeTradeAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="outgoingPlayerId" value={playerId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button type="submit" className={buttonClass({ variant: "primary" })}>
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
        actions={
          <Link
            href={`/dashboard/${saveId}/roster`}
            className="text-sm text-zinc-400 hover:text-team-ink"
          >
            ← Roster
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="space-y-4">
        <PlayerProfileHero
          playerId={player.playerId}
          portrait={player.portrait}
          firstName={player.firstName}
          lastName={player.lastName}
          jerseyNumber={player.jerseyNumber}
          position={player.position}
          age={player.age}
          overall={player.overall}
          potential={player.potentialOverall}
          archetypeLabel={archetypeLabel}
          heightInches={player.heightInches}
          weightPounds={player.weightPounds}
          teamName={player.teamName}
          teamAbbreviation={player.teamAbbreviation}
          branding={player.teamBranding}
          availabilityStatus={player.injuryKind}
        />
        <PlayerProfileSummary player={player} />
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
        {activeTab === "stats" ? (
          <StatisticsTab
            saveId={saveId}
            playerId={playerId}
            stats={player.stats}
          />
        ) : null}
        {activeTab === "development" ? (
          <>
            <DevelopmentTab
              identity={{
                overall: player.overall,
                potential: player.potentialOverall,
                age: player.age,
              }}
              development={player.development}
            />
            <PlayerAttributeTrends player={player} />
          </>
        ) : null}
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
