import type { Metadata } from "next";
import { canTradeDraftPick } from "@/systems/league-rules";
import { notFound } from "next/navigation";
import { getRequestSaveStore } from "@/application/request-save-store";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  PlayerTradeBuilder,
  type TradeBuilderTeam,
} from "@/components/trades/PlayerTradeBuilder";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";

export const metadata: Metadata = { title: "Propose Trade" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

function assetsFor(state: GameState, teamId: string) {
  const team = state.world.teams[teamId as keyof typeof state.world.teams];
  const players = (team?.roster ?? [])
    .map((id) => state.world.players[id])
    .filter((p) => p !== undefined)
    .map((p) => ({
      id: p.id as string,
      name: `${p.firstName} ${p.lastName}`,
      position: p.position as string,
      overall: calculatePlayerOverall(p.position, p.attributes),
      age: p.age,
    }));
  const picks = Object.values(state.world.draftPicks)
    .filter(
      (k) => k.ownerTeamId === teamId && canTradeDraftPick(state, k.id).allowed,
    )
    .sort((a, b) => a.seasonYear - b.seasonYear || a.round - b.round)
    .map((k) => ({
      id: k.id as string,
      label: `${k.seasonYear} Round ${k.round}${
        k.originalTeamId === teamId
          ? ""
          : ` (from ${state.world.teams[k.originalTeamId]?.city ?? "?"})`
      }`,
    }));
  return { id: teamId, players, picks };
}

export default async function ProposeTradePage(props: PageProps) {
  const { saveId } = await props.params;
  const { error } = await props.searchParams;
  const loaded = await getRequestSaveStore().load(saveId);
  if (!loaded) notFound();
  const state = loaded.state;
  const participation = state.user.participation;

  const heading = <SectionHeading as="h1" size="lg" title="Propose a trade" />;
  if (participation.mode === "single") {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 text-sm text-ink">
        {heading}
        <p>Trades with other players are only available in shared leagues.</p>
      </div>
    );
  }

  const me = participation.participants.find(
    (p) => p.id === participation.activeParticipantId,
  );
  const myTeamId = state.user.activeOwnerTeamId;
  const teamLabel = (teamId: string) => {
    const t = state.world.teams[teamId as keyof typeof state.world.teams];
    return t ? `${t.city} ${t.name}` : teamId;
  };

  const targets: TradeBuilderTeam[] = participation.participants
    .filter((p) => p.id !== me?.id)
    .flatMap((p) =>
      p.teamIds.map((teamId) => ({
        ...assetsFor(state, teamId),
        label: `${p.displayName} — ${teamLabel(teamId)}`,
      })),
    );

  const myTeamIds = new Set(me?.teamIds ?? []);
  const otherTeamLabels = new Map(targets.map((t) => [t.id, t.label]));
  const sentOffers = state.user.pendingOwnerDecisions
    .filter(
      (d) =>
        myTeamIds.has(d.payload.offeringTeamId) &&
        otherTeamLabels.has(d.payload.userTeamId),
    )
    .map((d) => {
      const proposal = d.payload.currentProposal ?? d.payload.proposal;
      const mine =
        proposal.sideA.teamId === d.payload.offeringTeamId
          ? proposal.sideA
          : proposal.sideB;
      const theirs = mine === proposal.sideA ? proposal.sideB : proposal.sideA;
      const describe = (side: typeof mine) => [
        ...side.playerIds.map((id) => {
          const p = state.world.players[id];
          return p ? `${p.firstName} ${p.lastName}` : id;
        }),
        ...side.draftPickIds.map((id) => {
          const k = state.world.draftPicks[id];
          return k ? `${k.seasonYear} R${k.round}` : id;
        }),
      ];
      return {
        id: d.id as string,
        toLabel: otherTeamLabels.get(d.payload.userTeamId) ?? "",
        sends: describe(mine),
        receives: describe(theirs),
      };
    });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 text-sm text-ink">
      {heading}
      <p className="text-muted">
        Offer a trade to another player. They accept, decline or counter on
        their turn; the AI never decides for them. You can withdraw an offer any
        time before they respond.
      </p>
      {targets.length === 0 ? (
        <p>No other players have a franchise yet.</p>
      ) : (
        <PlayerTradeBuilder
          saveId={saveId}
          returnPath={`/dashboard/${saveId}/trades/propose`}
          myTeamId={myTeamId}
          myTeam={assetsFor(state, myTeamId)}
          targets={targets}
          sentOffers={sentOffers}
          error={error}
        />
      )}
    </div>
  );
}
