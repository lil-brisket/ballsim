import { getContractSalaryForYear } from "@/domain/entities/contract";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { evaluateTrade } from "@/systems/trades/asset-valuation/complete-trade-evaluation";
import {
  projectDraftPick,
  tierDisplayLabel,
} from "@/systems/trades/asset-valuation/pick-projection";
import { motivationDisplayLabel } from "@/systems/trades/cpu-trade-generator";

export type TradeReviewAsset = {
  id: string;
  kind: "player" | "pick";
  name: string;
  detail: string;
  href: string | null;
};

export type TradeReviewRosterRow = {
  position: string;
  before: number;
  after: number;
};

export type TradeReviewView = {
  decisionId: string;
  offeringTeamName: string;
  receivingTeamName: string;
  motivationLabel: string | null;
  youReceive: TradeReviewAsset[];
  youSend: TradeReviewAsset[];
  recommendation: "favor_receive" | "favor_send" | "even";
  netValue: number;
  reasons: string[];
  rosterFitPct: number;
  strategicFitPct: number;
  financialPct: number;
  rosterImpact: TradeReviewRosterRow[];
  bothSidesOwned: boolean;
};

/**
 * Pure serializable trade-review model for Calendar interrupts and the
 * standalone trade page. No Date / BigInt / class instances.
 */
export function buildTradeReviewView(
  state: GameState,
  decisionId: string,
): TradeReviewView | null {
  const pending = state.user.pendingOwnerDecisions.find(
    (decision) => decision.id === decisionId,
  );
  if (!pending || pending.type !== "trade_offer") {
    return null;
  }

  const proposal = pending.payload.currentProposal ?? pending.payload.proposal;
  const userTeamId = pending.payload.userTeamId;
  const offeringTeamId = pending.payload.offeringTeamId;
  const evaluation = evaluateTrade(state, userTeamId, proposal);
  const offeringTeam = state.world.teams[offeringTeamId];
  const receivingTeam = state.world.teams[userTeamId];
  const offeringSide =
    proposal.sideA.teamId === offeringTeamId ? proposal.sideA : proposal.sideB;
  const userSide =
    proposal.sideA.teamId === userTeamId ? proposal.sideA : proposal.sideB;
  const saveId = state.meta.saveId;
  const motivation = pending.payload.motivation;

  return {
    decisionId: pending.id,
    offeringTeamName: offeringTeam
      ? `${offeringTeam.city} ${offeringTeam.name}`
      : offeringTeamId,
    receivingTeamName: receivingTeam
      ? `${receivingTeam.city} ${receivingTeam.name}`
      : userTeamId,
    motivationLabel: motivation ? motivationDisplayLabel(motivation) : null,
    youReceive: describeTradeSide(state, offeringSide, saveId),
    youSend: describeTradeSide(state, userSide, saveId),
    recommendation: evaluation.recommendation,
    netValue: evaluation.valueDifference,
    reasons: evaluation.reasons,
    rosterFitPct: Math.round(evaluation.rosterFit * 100),
    strategicFitPct: Math.round(evaluation.strategicFit * 100),
    financialPct: Math.round(evaluation.financialImpact * 100),
    rosterImpact: rosterDepthBeforeAfter(state, userTeamId, proposal),
    bothSidesOwned:
      state.user.ownedTeamIds.includes(offeringTeamId) &&
      state.user.ownedTeamIds.includes(userTeamId),
  };
}

function describeTradeSide(
  state: GameState,
  side: TradeProposal["sideA"],
  saveId: string,
): TradeReviewAsset[] {
  const year = state.competition.season.year;
  const assets: TradeReviewAsset[] = [];
  for (const playerId of side.playerIds) {
    const player = state.world.players[playerId];
    if (!player) {
      assets.push({
        id: playerId,
        kind: "player",
        name: "Unknown player",
        detail: "",
        href: null,
      });
      continue;
    }
    const ovr = calculatePlayerOverall(player.position, player.attributes);
    const contract = player.contractId
      ? state.business.contracts[player.contractId]
      : undefined;
    const salary = contract
      ? getContractSalaryForYear(contract, year)
      : undefined;
    const salaryLabel =
      salary !== undefined ? ` · $${(salary / 1_000_000).toFixed(1)}M` : "";
    assets.push({
      id: playerId,
      kind: "player",
      name: `${player.firstName} ${player.lastName}`,
      detail: `${player.position} · OVR ${ovr} · Age ${player.age}${salaryLabel}`,
      href: `/dashboard/${saveId}/players/${playerId}`,
    });
  }
  for (const pickId of side.draftPickIds) {
    const pick = state.world.draftPicks[pickId];
    if (!pick) {
      assets.push({
        id: pickId,
        kind: "pick",
        name: "Unknown pick",
        detail: "",
        href: null,
      });
      continue;
    }
    const projection = projectDraftPick(state, pick);
    assets.push({
      id: pickId,
      kind: "pick",
      name: `${pick.seasonYear} Round ${pick.round}`,
      detail: `${tierDisplayLabel(projection.tier)} · ~#${projection.projectedOverallPick} (range #${projection.rangeLow}–#${projection.rangeHigh}, ${projection.confidence} confidence)`,
      href: null,
    });
  }
  return assets;
}

function rosterDepthBeforeAfter(
  state: GameState,
  teamId: TeamId,
  proposal: TradeProposal,
): TradeReviewRosterRow[] {
  const team = state.world.teams[teamId];
  if (!team) return [];
  const outgoing =
    proposal.sideA.teamId === teamId
      ? proposal.sideA.playerIds
      : proposal.sideB.playerIds;
  const incoming =
    proposal.sideA.teamId === teamId
      ? proposal.sideB.playerIds
      : proposal.sideA.playerIds;

  return PLAYER_POSITIONS.map((position) => {
    const before = team.roster.filter((id) => {
      const player = state.world.players[id];
      return player?.position === position;
    }).length;
    let after = before;
    for (const id of outgoing) {
      if (state.world.players[id]?.position === position) after -= 1;
    }
    for (const id of incoming) {
      if (state.world.players[id]?.position === position) after += 1;
    }
    return { position, before, after };
  });
}
