/**
 * Trade Finder offer view-models. Pure projections — the search itself runs
 * in the game service (findTradeOffers on a working copy).
 */

import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { getContractSalaryForYear } from "@/domain/entities/contract";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import type { TeamBrandingView } from "@/state/team-branding-view";
import { toBrandingView } from "@/state/team-branding-view";
import { canTradeDraftPick } from "@/systems/league-rules";
import type { TradeOffer } from "@/systems/trades/trade-offer-finder";

export type TradeAssetView =
  | {
      kind: "player";
      id: string;
      name: string;
      position: string;
      overall: number;
      age: number;
      salary: number | null;
      href: string;
    }
  | {
      kind: "draftPick";
      id: string;
      /** "2027 1st" */
      name: string;
      /** Original team abbreviation when acquired from another team. */
      viaAbbreviation: string | null;
    };

export type TradeInterestLevel =
  "very_interested" | "interested" | "open" | "lukewarm";

export type TradeOfferView = {
  counterpartyTeamId: string;
  counterpartyName: string;
  counterpartyAbbreviation: string;
  counterpartyBranding: TeamBrandingView | null;
  /** 0–100 */
  interest: number;
  interestLevel: TradeInterestLevel;
  send: TradeAssetView[];
  receive: TradeAssetView[];
  proposal: TradeProposal;
};

export function tradeInterestLevel(interest: number): TradeInterestLevel {
  if (interest >= 75) return "very_interested";
  if (interest >= 60) return "interested";
  if (interest >= 45) return "open";
  return "lukewarm";
}

export function toTradeOfferViews(
  state: GameState,
  offers: readonly TradeOffer[],
): TradeOfferView[] {
  const saveId = state.meta.saveId;
  return offers.map((offer) => {
    const team = state.world.teams[offer.counterpartyTeamId];
    return {
      counterpartyTeamId: offer.counterpartyTeamId,
      counterpartyName: team
        ? `${team.city} ${team.name}`
        : offer.counterpartyTeamId,
      counterpartyAbbreviation: team?.abbreviation ?? "???",
      counterpartyBranding: team ? toBrandingView(team.branding) : null,
      interest: offer.interest,
      interestLevel: tradeInterestLevel(offer.interest),
      send: sideAssetViews(state, offer.proposal.sideA, saveId),
      receive: sideAssetViews(state, offer.proposal.sideB, saveId),
      proposal: offer.proposal,
    };
  });
}

/** Picks the team owns that can be traded now (status + trade horizon). */
export function toTradablePickViews(
  state: GameState,
  teamId: TeamId,
): Extract<TradeAssetView, { kind: "draftPick" }>[] {
  return Object.values(state.world.draftPicks)
    .filter(
      (pick) =>
        pick.ownerTeamId === teamId &&
        canTradeDraftPick(state, pick.id).allowed,
    )
    .sort(
      (a, b) =>
        a.seasonYear - b.seasonYear ||
        a.round - b.round ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .map((pick) => pickView(state, pick.id))
    .filter((view) => view !== null);
}

function sideAssetViews(
  state: GameState,
  side: TradeProposal["sideA"],
  saveId: string,
): TradeAssetView[] {
  return [
    ...side.playerIds.map((id) => playerView(state, id, saveId)),
    ...side.draftPickIds.map((id) => pickView(state, id)),
  ].filter((view) => view !== null);
}

function playerView(
  state: GameState,
  playerId: PlayerId,
  saveId: string,
): TradeAssetView | null {
  const player = state.world.players[playerId];
  if (!player) {
    return null;
  }
  const contract = player.contractId
    ? state.business.contracts[player.contractId]
    : undefined;
  return {
    kind: "player",
    id: player.id,
    name: `${player.firstName} ${player.lastName}`,
    position: player.position,
    overall: calculatePlayerOverall(player.position, player.attributes),
    age: player.age,
    salary:
      contract !== undefined
        ? (getContractSalaryForYear(contract, state.competition.season.year) ??
          null)
        : null,
    href: `/dashboard/${saveId}/players/${player.id}`,
  };
}

function pickView(
  state: GameState,
  pickId: DraftPickId,
): Extract<TradeAssetView, { kind: "draftPick" }> | null {
  const pick = state.world.draftPicks[pickId];
  if (!pick) {
    return null;
  }
  const via =
    pick.originalTeamId !== pick.ownerTeamId
      ? (state.world.teams[pick.originalTeamId]?.abbreviation ?? null)
      : null;
  return {
    kind: "draftPick",
    id: pick.id,
    name: `${pick.seasonYear} ${pick.round === 1 ? "1st" : "2nd"}`,
    viaAbbreviation: via,
  };
}
