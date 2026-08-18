import type { FranchiseOps } from "@/domain/entities/franchise-ops";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import {
  explainTicketDemand,
  fanFacilityDemandRaw,
} from "@/systems/demand/calculate-demand";
import {
  allocateGameDaySeats,
  applyConsumerCycleToDemandScore,
  concessionsFromAttendance,
  merchandiseFromAttendance,
  premiumCapacityForArena,
  resolvePremiumOccupancy,
  revenuePerAttendee,
  starMerchandiseFactor,
} from "@/systems/demand/resolve-attendance";
import { arenaCapacityForLevel } from "@/systems/facilities-config";

export type GameDayForecast = {
  demandScore: number;
  attendance: number;
  gaAttendance: number;
  premiumOccupancy: number;
  capacity: number;
  premiumCapacity: number;
  fillRatePct: number;
  ticketPrice: number;
  premiumTicketPrice: number;
  ticketRevenue: number;
  premiumRevenue: number;
  merchRevenue: number;
  concessionsRevenue: number;
  totalGameDayRevenue: number;
  revenuePerAttendee: number | null;
};

function teamWinPct(state: GameState, teamId: string): number {
  const standing = state.competition.standings.byTeamId[teamId];
  if (!standing) {
    return 0.5;
  }
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
  if (players.length === 0) {
    return 50;
  }
  const top = players.slice(0, Math.min(3, players.length));
  return top.reduce((sum, ovr) => sum + ovr, 0) / top.length;
}

/**
 * Constant-condition next home game-day estimate. Does not simulate games.
 * Uses opponent winPct 0.5 when no specific opponent is known.
 */
export function forecastNextHomeGameDay(
  state: GameState,
  teamId: string,
  ops: FranchiseOps,
): GameDayForecast {
  const team = state.world.teams[teamId];
  const capacity = arenaCapacityForLevel(ops.facilities.arena.level);
  const explanation = explainTicketDemand({
    marketSize: ops.marketSize,
    fanSentiment: ops.fanSentiment,
    reputation: team?.reputation ?? 50,
    awareness: ops.marketing.awareness,
    mediaAttention: ops.mediaAttention,
    leaguePopularity: state.business.leagueEconomy.popularity,
    winPct: teamWinPct(state, teamId),
    fanFacility: fanFacilityDemandRaw(ops.facilities.fan.level),
    opponentWinPct: 0.5,
  });
  const demandScore = applyConsumerCycleToDemandScore(
    explanation.score,
    state.business.leagueEconomy.cycle,
  );
  const premiumCapacity = premiumCapacityForArena(
    capacity,
    ops.facilities.arena.level,
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
    gaTicketPrice: ops.ticketPrice,
  });
  const ticketRevenue = seats.gaAttendance * ops.ticketPrice;
  const premiumRevenue = seats.premiumOccupancy * ops.premiumTicketPrice;
  const totalAttendance = seats.gaAttendance + seats.premiumOccupancy;
  const merchRevenue = merchandiseFromAttendance(
    totalAttendance,
    ops.fanSentiment,
    starMerchandiseFactor(rosterStarAverage(state, teamId)),
  );
  const concessionsRevenue = concessionsFromAttendance(
    totalAttendance,
    ops.fanSentiment,
  );
  const totalGameDayRevenue =
    ticketRevenue + premiumRevenue + merchRevenue + concessionsRevenue;
  return {
    demandScore,
    attendance: totalAttendance,
    gaAttendance: seats.gaAttendance,
    premiumOccupancy: seats.premiumOccupancy,
    capacity,
    premiumCapacity,
    fillRatePct:
      capacity > 0 ? Math.round((totalAttendance / capacity) * 100) : 0,
    ticketPrice: ops.ticketPrice,
    premiumTicketPrice: ops.premiumTicketPrice,
    ticketRevenue,
    premiumRevenue,
    merchRevenue,
    concessionsRevenue,
    totalGameDayRevenue,
    revenuePerAttendee: revenuePerAttendee(
      totalAttendance,
      ticketRevenue,
      merchRevenue,
      concessionsRevenue,
      premiumRevenue,
    ),
  };
}
