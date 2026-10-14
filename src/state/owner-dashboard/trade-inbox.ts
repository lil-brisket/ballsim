import type { GameState } from "@/state/game-state";
import { evaluateTrade } from "@/systems/trades/asset-valuation/complete-trade-evaluation";
import { toBrandingView } from "@/state/team-branding-view";
import { motivationDisplayLabel } from "@/systems/trades/cpu-trade-generator";
import type { CalendarContext } from "@/systems/simulation/calendar-context";
import { asTeamId } from "@/domain/ids";
import { derivePlayoffResults } from "@/systems/franchise-history";
import { getActiveOwnedFranchise } from "@/state/owner-context";
import { calculateFranchiseValue } from "@/state/franchise-value";
import type {
  OwnerDashboardPendingTradeOffer,
  OwnerDashboardTradeInbox,
  CanonicalDashboardData,
  OwnerDashboardHealth,
  OwnerDashboardSeasonRecap,
} from "@/state/owner-dashboard/types";

export function buildPendingTradeOfferView(
  state: GameState,
): OwnerDashboardPendingTradeOffer | null {
  const activeTeamId = state.user.activeOwnerTeamId;
  const pending =
    state.user.pendingOwnerDecisions.find(
      (d) =>
        d.type === "trade_offer" &&
        (d.payload.status === undefined ||
          d.payload.status === "pending" ||
          d.payload.status === "negotiating") &&
        d.payload.userTeamId === activeTeamId,
    ) ??
    state.user.pendingOwnerDecisions.find(
      (d) =>
        d.type === "trade_offer" &&
        (d.payload.status === undefined ||
          d.payload.status === "pending" ||
          d.payload.status === "negotiating"),
    );
  if (!pending) {
    return null;
  }
  const offeringTeam = state.world.teams[pending.payload.offeringTeamId];
  const userTeamId = pending.payload.userTeamId;
  const receivingTeam = state.world.teams[userTeamId];
  const proposal = pending.payload.currentProposal ?? pending.payload.proposal;
  const offeringSide =
    proposal.sideA.teamId === pending.payload.offeringTeamId
      ? proposal.sideA
      : proposal.sideB;
  const userSide =
    proposal.sideA.teamId === userTeamId ? proposal.sideA : proposal.sideB;
  const bothSidesOwned =
    state.user.ownedTeamIds.includes(pending.payload.offeringTeamId) &&
    state.user.ownedTeamIds.includes(userTeamId);

  const evaluation = evaluateTrade(state, userTeamId, proposal);
  const motivation = pending.payload.motivation;

  return {
    decisionId: pending.id,
    offeringTeamId: pending.payload.offeringTeamId,
    offeringTeamName: offeringTeam
      ? `${offeringTeam.city} ${offeringTeam.name}`
      : pending.payload.offeringTeamId,
    offeringTeamBranding: toBrandingView(offeringTeam?.branding),
    receivingTeamId: userTeamId,
    receivingTeamName: receivingTeam
      ? `${receivingTeam.city} ${receivingTeam.name}`
      : userTeamId,
    receivingTeamBranding: toBrandingView(receivingTeam?.branding),
    primaryTeamId: pending.primaryTeamId,
    bothSidesOwned,
    createdOn: pending.createdOn,
    youReceive: describeTradeSideAssets(state, offeringSide),
    theyReceive: describeTradeSideAssets(state, userSide),
    valueSummary: evaluation.recommendation,
    motivationLabel: motivation ? motivationDisplayLabel(motivation) : null,
    reasons: evaluation.reasons.slice(0, 4),
    expiresOn: pending.payload.expiresOn ?? null,
  };
}

export function buildTradeInbox(state: GameState): OwnerDashboardTradeInbox {
  const open = state.user.pendingOwnerDecisions.filter(
    (d) =>
      d.type === "trade_offer" &&
      (d.payload.status === undefined ||
        d.payload.status === "pending" ||
        d.payload.status === "negotiating"),
  );
  const active = state.user.activeOwnerTeamId;
  return {
    totalPending: open.length,
    pendingForActiveTeam: open.filter((d) => d.payload.userTeamId === active)
      .length,
  };
}

function describeTradeSideAssets(
  state: GameState,
  side: { playerIds: string[]; draftPickIds: string[] },
): string[] {
  const labels: string[] = [];
  for (const playerId of side.playerIds) {
    const player = state.world.players[playerId];
    labels.push(
      player ? `${player.firstName} ${player.lastName}` : `Player ${playerId}`,
    );
  }
  for (const pickId of side.draftPickIds) {
    const pick = state.world.draftPicks[pickId];
    labels.push(
      pick ? `${pick.seasonYear} Round ${pick.round} pick` : `Pick ${pickId}`,
    );
  }
  return labels;
}

export function buildSeasonRecap(
  data: CanonicalDashboardData,
  health: OwnerDashboardHealth,
  calendar: CalendarContext,
): OwnerDashboardSeasonRecap {
  const teamId = asTeamId(data.teamId);
  const standing = data.snapshot.controlledStanding;
  const playoffMap = derivePlayoffResults(data.state);
  const playoffResult = playoffMap[teamId] ?? "missed";
  const completed = getActiveOwnedFranchise(data.state).objectives.filter(
    (o) => o.status === "completed" && o.seasonYear === data.year,
  ).length;
  const failed = getActiveOwnedFranchise(data.state).objectives.filter(
    (o) => o.status === "failed" && o.seasonYear === data.year,
  ).length;
  return {
    record: `${standing.wins}–${standing.losses}`,
    playoffResult,
    revenue: health.revenue,
    expenses: health.expenses,
    netIncome: health.netIncome,
    cash: health.cash,
    franchiseValue: calculateFranchiseValue(data.state, teamId),
    completedObjectives: completed,
    failedObjectives: failed,
    story: calendar.seasonStory,
  };
}
