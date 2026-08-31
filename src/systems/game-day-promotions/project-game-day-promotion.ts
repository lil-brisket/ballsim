import type {
  GameDayPromotionProjection,
} from "@/domain/entities/game-day-promotion";
import type { Game } from "@/domain/entities/game";
import type { TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import {
  calculateTicketDemand,
  fanFacilityDemandRaw,
} from "@/systems/demand/calculate-demand";
import { PLAYOFF_DEMAND_UPLIFT } from "@/systems/demand/demand-config";
import {
  allocateGameDaySeats,
  applyConsumerCycleToDemandScore,
  applyPlayoffDemandUplift,
  concessionsFromAttendance,
  merchandiseFromAttendance,
  premiumCapacityForArena,
  resolvePremiumOccupancy,
  starMerchandiseFactor,
} from "@/systems/demand/resolve-attendance";
import { arenaCapacity } from "@/systems/facilities";
import { getGameDayPromotionDefinition } from "@/systems/game-day-promotions/game-day-promotion-catalog";
import { PROMOTION_PROJECTION_RANGE_FRACTION } from "@/systems/game-day-promotions/game-day-promotion-config";
import {
  buildEffectivenessContext,
  evaluatePromotionEffectiveness,
} from "@/systems/game-day-promotions/evaluate-promotion-effectiveness";

function teamWinPct(state: GameState, teamId: string): number {
  const standing = state.competition.standings.byTeamId[teamId];
  if (!standing) return 0.5;
  const games = standing.wins + standing.losses;
  return games === 0 ? 0.5 : standing.wins / games;
}

function rosterStarAverage(state: GameState, teamId: string): number {
  const players = Object.values(state.world.players)
    .filter((player) => player.teamId === teamId)
    .map((player) =>
      calculatePlayerOverall(player.position, player.attributes),
    )
    .sort((a, b) => b - a);
  if (players.length === 0) return 50;
  const top = players.slice(0, Math.min(3, players.length));
  return top.reduce((sum, ovr) => sum + ovr, 0) / top.length;
}

export type GameDayRevenueSnapshot = {
  demandScore: number;
  attendance: number;
  gaAttendance: number;
  premiumOccupancy: number;
  ticketRevenue: number;
  premiumRevenue: number;
  merchRevenue: number;
  concessionsRevenue: number;
  totalGameDayRevenue: number;
};

function computeGameDaySnapshot(
  state: GameState,
  teamId: TeamId,
  game: Game,
  options: {
    demandBoost: number;
    ticketPriceMultiplier: number;
    merchMultiplier: number;
    concessionMultiplier: number;
  },
): GameDayRevenueSnapshot {
  const ops = state.business.franchiseOps[teamId]!;
  const team = state.world.teams[teamId]!;
  const demand = calculateTicketDemand({
    marketSize: ops.marketSize,
    fanSentiment: ops.fanSentiment,
    reputation: team.reputation,
    awareness: ops.marketing.awareness,
    mediaAttention: ops.mediaAttention,
    leaguePopularity: state.business.leagueEconomy.popularity,
    winPct: teamWinPct(state, teamId),
    fanFacility: fanFacilityDemandRaw(ops.facilities.fan.level),
    opponentWinPct: teamWinPct(state, game.awayTeamId),
  });
  let demandScore = applyConsumerCycleToDemandScore(
    demand.score,
    state.business.leagueEconomy.cycle,
  );
  const inPlayoffs =
    state.competition.playoffs.status === "in_progress" ||
    state.competition.playoffs.status === "complete";
  if (inPlayoffs) {
    demandScore = applyPlayoffDemandUplift(demandScore, PLAYOFF_DEMAND_UPLIFT);
  }
  demandScore = Math.max(
    0,
    Math.min(100, Math.round(demandScore + options.demandBoost)),
  );

  const capacity = arenaCapacity(state, teamId);
  const premiumCapacity = premiumCapacityForArena(
    capacity,
    ops.facilities.arena.level,
  );
  const effectiveGaPrice = Math.max(
    1,
    Math.round(ops.ticketPrice * options.ticketPriceMultiplier),
  );
  const premiumOccupancyRaw = resolvePremiumOccupancy(
    demandScore,
    ops.premiumTicketPrice,
    premiumCapacity,
  );
  const seats = allocateGameDaySeats({
    arenaCapacity: capacity,
    premiumCapacity,
    premiumOccupancy: premiumOccupancyRaw,
    gaDemandScore: demandScore,
    gaTicketPrice: effectiveGaPrice,
  });
  const ticketRevenue = seats.gaAttendance * effectiveGaPrice;
  const premiumRevenue = seats.premiumOccupancy * ops.premiumTicketPrice;
  const totalAttendance = seats.gaAttendance + seats.premiumOccupancy;
  const merchRevenue = Math.round(
    merchandiseFromAttendance(
      totalAttendance,
      ops.fanSentiment,
      starMerchandiseFactor(rosterStarAverage(state, teamId)),
    ) * options.merchMultiplier,
  );
  const concessionsRevenue = Math.round(
    concessionsFromAttendance(totalAttendance, ops.fanSentiment) *
      options.concessionMultiplier,
  );
  return {
    demandScore,
    attendance: totalAttendance,
    gaAttendance: seats.gaAttendance,
    premiumOccupancy: seats.premiumOccupancy,
    ticketRevenue,
    premiumRevenue,
    merchRevenue,
    concessionsRevenue,
    totalGameDayRevenue:
      ticketRevenue + premiumRevenue + merchRevenue + concessionsRevenue,
  };
}

/**
 * Pure projection for UI + AI. Returns ranges (not false precision).
 */
export function projectGameDayPromotion(
  state: GameState,
  teamId: TeamId,
  game: Game,
  promotionId: string,
): GameDayPromotionProjection | null {
  const definition = getGameDayPromotionDefinition(promotionId);
  if (!definition) return null;

  const context = buildEffectivenessContext(state, teamId, game, promotionId);
  const evaluated = evaluatePromotionEffectiveness(definition, context);

  const baseline = computeGameDaySnapshot(state, teamId, game, {
    demandBoost: 0,
    ticketPriceMultiplier: 1,
    merchMultiplier: 1,
    concessionMultiplier: 1,
  });
  const withPromo = computeGameDaySnapshot(state, teamId, game, {
    demandBoost: evaluated.effectiveDemandBoost,
    ticketPriceMultiplier: definition.effects.ticketPriceMultiplier ?? 1,
    merchMultiplier: definition.effects.merchMultiplier,
    concessionMultiplier: definition.effects.concessionMultiplier,
  });

  const attendanceDiff = withPromo.attendance - baseline.attendance;
  const revenueDiff =
    withPromo.totalGameDayRevenue - baseline.totalGameDayRevenue;
  const netMid = revenueDiff - definition.cost;
  const range = PROMOTION_PROJECTION_RANGE_FRACTION;

  return {
    attendanceMid: withPromo.attendance,
    attendanceLow: Math.max(
      0,
      Math.round(withPromo.attendance * (1 - range)),
    ),
    attendanceHigh: Math.round(withPromo.attendance * (1 + range)),
    netImpactMid: netMid,
    netImpactLow: Math.round(netMid - Math.abs(revenueDiff) * range - definition.cost * 0.05),
    netImpactHigh: Math.round(netMid + Math.abs(revenueDiff) * range),
    attendanceDifferenceMid: attendanceDiff,
    cost: definition.cost,
  };
}

export { computeGameDaySnapshot };
