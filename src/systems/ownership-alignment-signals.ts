/**
 * Contextual decision scorers for ownership strategic friction.
 * Evaluate decisions against living OwnershipExpectations (not raw philosophy).
 */

import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type {
  AlignmentEvidence,
  AlignmentEvidenceDirection,
  AlignmentEvidenceSignificance,
  AlignmentDimension,
} from "@/domain/entities/ownership-confidence";
import type { OwnershipExpectations } from "@/domain/entities/ownership-expectations";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { buildOwnershipExpectations } from "@/systems/ownership-expectations";
import { calculateDraftPickValue } from "@/systems/trades/draft-pick-value";
import { getTeamPayroll } from "@/systems/salary-cap";

export type DecisionSignalInput = {
  state: GameState;
  teamId?: TeamId;
  expectations?: OwnershipExpectations;
};

function evidenceId(prefix: string, occurredOn: string, salt: string): string {
  return `${prefix}_${occurredOn}_${salt}`.replace(/[^a-zA-Z0-9_:-]/g, "_");
}

function clampSignificance(
  magnitude: number,
): AlignmentEvidenceSignificance {
  if (magnitude >= 0.72) {
    return "major";
  }
  if (magnitude >= 0.28) {
    return "meaningful";
  }
  return "minor";
}

function directionFromDelta(delta: number): AlignmentEvidenceDirection {
  if (delta > 0.08) {
    return "aligned";
  }
  if (delta < -0.08) {
    return "conflicting";
  }
  return "neutral";
}

function makeEvidence(input: {
  id: string;
  occurredOn: string;
  significance: AlignmentEvidenceSignificance;
  direction: AlignmentEvidenceDirection;
  summary: string;
  detail?: string;
  dimension: AlignmentDimension;
}): AlignmentEvidence {
  return {
    id: input.id,
    occurredOn: input.occurredOn,
    kind: "decision",
    significance: input.significance,
    direction: input.direction,
    summary: input.summary,
    detail: input.detail,
    dimension: input.dimension,
  };
}

function resolveExpectations(input: DecisionSignalInput): OwnershipExpectations {
  return (
    input.expectations ??
    buildOwnershipExpectations(input.state, input.teamId ?? input.state.user.controlledTeamId)
  );
}

function playerAge(state: GameState, playerId: PlayerId): number {
  return state.world.players[playerId]?.age ?? 27;
}

function playerOvr(state: GameState, playerId: PlayerId): number {
  const player = state.world.players[playerId];
  if (!player) {
    return 50;
  }
  return calculatePlayerOverall(player.position, player.attributes);
}

/**
 * Score a completed trade involving the controlled team.
 */
export function scoreTradeDecision(
  state: GameState,
  proposal: TradeProposal,
  expectations?: OwnershipExpectations,
): AlignmentEvidence | null {
  const teamId = state.user.controlledTeamId;
  if (proposal.sideA.teamId !== teamId && proposal.sideB.teamId !== teamId) {
    return null;
  }
  const exp = expectations ?? buildOwnershipExpectations(state, teamId);
  const ourSide = proposal.sideA.teamId === teamId ? proposal.sideA : proposal.sideB;
  const theirSide = proposal.sideA.teamId === teamId ? proposal.sideB : proposal.sideA;

  const outgoingPlayers = ourSide.playerIds;
  const incomingPlayers = theirSide.playerIds;
  const outgoingPicks = ourSide.draftPickIds;
  const incomingPicks = theirSide.draftPickIds;

  let netStarOutgoing = 0;
  let netYouthIncoming = 0;
  let agingOutgoing = 0;
  for (const playerId of outgoingPlayers) {
    const age = playerAge(state, playerId);
    const ovr = playerOvr(state, playerId);
    if (ovr >= 78 && age <= 30) {
      netStarOutgoing += 1;
    }
    if (age >= 32) {
      agingOutgoing += 1;
    }
  }
  for (const playerId of incomingPlayers) {
    const age = playerAge(state, playerId);
    const ovr = playerOvr(state, playerId);
    if (age <= 24 || (age <= 26 && ovr < 75)) {
      netYouthIncoming += 1;
    }
    if (ovr >= 78 && age <= 30) {
      netStarOutgoing -= 1;
    }
  }

  let pickNet = 0;
  for (const pickId of incomingPicks) {
    const pick = state.world.draftPicks[pickId];
    if (pick) {
      pickNet += calculateDraftPickValue(pick);
    }
  }
  for (const pickId of outgoingPicks) {
    const pick = state.world.draftPicks[pickId];
    if (pick) {
      pickNet -= calculateDraftPickValue(pick);
    }
  }

  const competitive = exp.competitiveExpectation;
  const roster = exp.rosterBuildingExpectation;
  let delta = 0;
  const reasons: string[] = [];

  // Contending / compete: losing stars for picks is bad; acquiring stars for picks is good.
  if (competitive === "compete" || competitive === "contend") {
    if (netStarOutgoing > 0 && pickNet > 0) {
      delta -= 0.55 * netStarOutgoing;
      reasons.push("moved core talent for future assets while ownership expects contention");
    }
    if (netStarOutgoing < 0) {
      delta += 0.4;
      reasons.push("added established talent to a competitive roster");
    }
    if (outgoingPicks.length >= 2) {
      delta += 0.25 * Math.min(exp.tolerance.assetSacrifice + 0.2, 1);
      reasons.push("converted draft capital into present help");
    }
    if (incomingPicks.length >= 2 && agingOutgoing === 0) {
      delta -= 0.35;
      reasons.push("accumulated picks instead of improving the current roster");
    }
  }

  // Rebuild / develop: acquiring picks and youth is good; rentals for picks is bad.
  if (competitive === "rebuild" || competitive === "develop") {
    if (pickNet > 0 || netYouthIncoming > 0) {
      delta += 0.4;
      reasons.push("added future assets during a development window");
    }
    if (outgoingPicks.length >= 2 && agingOutgoing === 0) {
      delta -= 0.5;
      reasons.push("sacrificed future picks without a clear long-term return");
    }
    if (netStarOutgoing > 0 && pickNet > 0) {
      delta += 0.35;
      reasons.push("moved present talent for future assets while rebuilding");
    }
  }

  if (roster === "youth_focus") {
    if (netYouthIncoming > 0 || pickNet > 0) {
      delta += 0.2;
    }
    if (outgoingPicks.length > 0 && incomingPlayers.some((id) => playerAge(state, id) >= 30)) {
      delta -= 0.35;
      reasons.push("spent draft capital on a short-term veteran");
    }
  }

  if (roster === "win_now_roster" && pickNet > 40 && netStarOutgoing >= 0) {
    delta -= 0.25;
    reasons.push("favored asset accumulation over roster quality");
  }

  if (exp.philosophy === "financially_conservative") {
    // Prefer deals that do not explode payroll; approximate via player counts.
    if (incomingPlayers.length > outgoingPlayers.length + 1) {
      delta -= 0.15;
    }
  }

  if (reasons.length === 0 && Math.abs(delta) < 0.05) {
    return null;
  }

  const magnitude = Math.min(1, Math.abs(delta));
  const significance = clampSignificance(magnitude);
  const direction = directionFromDelta(delta);
  const date = state.world.calendar.currentDate;
  const salt = [
    ...outgoingPlayers,
    ...incomingPlayers,
    ...outgoingPicks,
    ...incomingPicks,
  ].join("-");

  return makeEvidence({
    id: evidenceId("trade", date, salt || "empty"),
    occurredOn: date,
    significance,
    direction,
    summary:
      direction === "aligned"
        ? "Trade aligned with ownership's current roster direction"
        : direction === "conflicting"
          ? "Trade conflicted with ownership's current expectations"
          : "Trade had limited strategic impact",
    detail: reasons[0],
    dimension: pickNet !== 0 ? "assets" : "roster",
  });
}

/**
 * Score a free-agent signing for the controlled team.
 */
export function scoreFreeAgentSigning(
  state: GameState,
  playerId: PlayerId,
  salary: number,
  years: number,
  expectations?: OwnershipExpectations,
): AlignmentEvidence | null {
  const teamId = state.user.controlledTeamId;
  const exp = expectations ?? buildOwnershipExpectations(state, teamId);
  const age = playerAge(state, playerId);
  const ovr = playerOvr(state, playerId);
  const payroll = getTeamPayroll(teamId, state.competition.season.year, state);
  const date = state.world.calendar.currentDate;

  let delta = 0;
  const reasons: string[] = [];
  const expensive = salary >= 12_000_000 || years >= 3;
  const minDeal = salary <= 2_500_000 && years <= 2;

  if (exp.competitiveExpectation === "contend" || exp.competitiveExpectation === "compete") {
    if (ovr >= 75) {
      delta += 0.4;
      reasons.push("added a contributor for a competitive roster");
    } else if (age <= 23 && ovr < 70) {
      delta -= 0.2;
      reasons.push("prioritized a prospect over immediate help");
    }
  }

  if (exp.competitiveExpectation === "rebuild" || exp.rosterBuildingExpectation === "youth_focus") {
    if (age <= 25) {
      delta += 0.35;
      reasons.push("added young talent consistent with development focus");
    }
    if (age >= 31 && expensive) {
      delta -= 0.5;
      reasons.push("committed expensive years to an aging veteran while developing");
    }
  }

  if (exp.financialExpectation === "preserve_cash" && expensive) {
    delta -= 0.45;
    reasons.push("increased financial exposure while ownership wants payroll discipline");
  }
  if (exp.financialExpectation === "sustainable" && expensive && payroll > 90_000_000) {
    delta -= 0.25;
    reasons.push("payroll growth is outpacing ownership's tolerance");
  }
  if (exp.financialExpectation === "invest" && ovr >= 76) {
    delta += 0.15;
  }

  // Future owner with ready young core: veteran leader can be aligned.
  if (
    exp.philosophy === "build_for_the_future" &&
    exp.rosterBuildingExpectation === "balanced" &&
    age >= 30 &&
    age <= 34 &&
    ovr >= 74 &&
    !expensive
  ) {
    delta += 0.35;
    reasons.push("signed a veteran leader to support a developed young core");
  }

  if (minDeal && Math.abs(delta) < 0.15) {
    return makeEvidence({
      id: evidenceId("fa", date, String(playerId)),
      occurredOn: date,
      significance: "minor",
      direction: "neutral",
      summary: "Signed a low-commitment free agent",
      dimension: "roster",
    });
  }

  if (reasons.length === 0 && Math.abs(delta) < 0.08) {
    return null;
  }

  const magnitude = Math.min(1, Math.abs(delta) + (expensive ? 0.15 : 0));
  return makeEvidence({
    id: evidenceId("fa", date, String(playerId)),
    occurredOn: date,
    significance: clampSignificance(magnitude),
    direction: directionFromDelta(delta),
    summary:
      directionFromDelta(delta) === "aligned"
        ? "Free-agent signing supported ownership expectations"
        : directionFromDelta(delta) === "conflicting"
          ? "Free-agent signing conflicted with ownership expectations"
          : "Free-agent signing had limited strategic impact",
    detail: reasons[0],
    dimension: expensive ? "financial" : "roster",
  });
}

/**
 * Score a user draft selection.
 */
export function scoreDraftSelection(
  state: GameState,
  expectations?: OwnershipExpectations,
): AlignmentEvidence {
  const exp = expectations ?? buildOwnershipExpectations(state);
  const date = state.world.calendar.currentDate;
  const youth =
    exp.rosterBuildingExpectation === "youth_focus" ||
    exp.competitiveExpectation === "rebuild" ||
    exp.competitiveExpectation === "develop";
  return makeEvidence({
    id: evidenceId("draft", date, String(state.competition.season.year)),
    occurredOn: date,
    significance: "meaningful",
    direction: youth ? "aligned" : "neutral",
    summary: youth
      ? "Drafted a prospect consistent with long-term development"
      : "Used a draft selection",
    dimension: "assets",
  });
}

/**
 * Score starting a facility upgrade.
 */
export function scoreFacilityUpgrade(
  state: GameState,
  category: string,
  expectations?: OwnershipExpectations,
): AlignmentEvidence {
  const exp = expectations ?? buildOwnershipExpectations(state);
  const date = state.world.calendar.currentDate;
  const marketFocus =
    exp.marketExpectation === "grow" ||
    exp.marketExpectation === "aggressive_growth";
  const financialOk = exp.financialExpectation !== "preserve_cash";
  let direction: AlignmentEvidenceDirection = "neutral";
  let detail: string | undefined;
  if (marketFocus) {
    direction = "aligned";
    detail = "Facility investment supports ownership's market-growth mandate";
  } else if (!financialOk && (category === "arena" || category === "fan")) {
    direction = "conflicting";
    detail = "Large facility spending conflicts with financial preservation";
  } else {
    direction = "aligned";
    detail = "Infrastructure investment is generally acceptable";
  }
  const major = category === "arena";
  return makeEvidence({
    id: evidenceId("facility", date, category),
    occurredOn: date,
    significance: major ? "major" : "meaningful",
    direction,
    summary: `Started a ${category} facility upgrade`,
    detail,
    dimension: "market",
  });
}

/**
 * Score a marketing budget change.
 */
export function scoreMarketingBudgetChange(
  state: GameState,
  previousBudget: number,
  nextBudget: number,
  expectations?: OwnershipExpectations,
): AlignmentEvidence | null {
  const exp = expectations ?? buildOwnershipExpectations(state);
  const date = state.world.calendar.currentDate;
  const deltaBudget = nextBudget - previousBudget;
  if (Math.abs(deltaBudget) < 50_000) {
    return makeEvidence({
      id: evidenceId("mkt", date, String(nextBudget)),
      occurredOn: date,
      significance: "minor",
      direction: "neutral",
      summary: "Adjusted marketing budget slightly",
      dimension: "market",
    });
  }
  const wantsGrowth =
    exp.marketExpectation === "grow" ||
    exp.marketExpectation === "aggressive_growth";
  let direction: AlignmentEvidenceDirection = "neutral";
  let detail: string | undefined;
  if (wantsGrowth && deltaBudget > 0) {
    direction = "aligned";
    detail = "Increased marketing investment matches ownership's growth focus";
  } else if (wantsGrowth && deltaBudget < 0) {
    direction = "conflicting";
    detail = "Reduced marketing while ownership wants market growth";
  } else if (exp.financialExpectation === "preserve_cash" && deltaBudget > 250_000) {
    direction = "conflicting";
    detail = "Marketing spend rose while ownership wants cash preserved";
  } else if (deltaBudget > 0) {
    direction = "aligned";
  }

  return makeEvidence({
    id: evidenceId("mkt", date, String(nextBudget)),
    occurredOn: date,
    significance: Math.abs(deltaBudget) >= 400_000 ? "meaningful" : "minor",
    direction,
    summary:
      deltaBudget > 0
        ? "Increased marketing investment"
        : "Reduced marketing investment",
    detail,
    dimension: "market",
  });
}

export { resolveExpectations };
