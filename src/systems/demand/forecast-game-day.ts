import type { FranchiseOps } from "@/domain/entities/franchise-ops";
import type { GameState } from "@/state/game-state";
import { explainTicketDemand } from "@/systems/demand/calculate-demand";
import {
  concessionsFromAttendance,
  merchandiseFromAttendance,
  resolveAttendance,
  revenuePerAttendee,
} from "@/systems/demand/resolve-attendance";
import { arenaCapacityForLevel } from "@/systems/facilities-config";

export type GameDayForecast = {
  demandScore: number;
  attendance: number;
  capacity: number;
  fillRatePct: number;
  ticketPrice: number;
  ticketRevenue: number;
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

/**
 * Constant-condition next home game-day estimate. Does not simulate games.
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
  });
  const attendance = resolveAttendance(
    explanation.score,
    ops.ticketPrice,
    capacity,
  );
  const ticketRevenue = attendance * ops.ticketPrice;
  const merchRevenue = merchandiseFromAttendance(attendance, ops.fanSentiment);
  const concessionsRevenue = concessionsFromAttendance(
    attendance,
    ops.fanSentiment,
  );
  const totalGameDayRevenue = ticketRevenue + merchRevenue + concessionsRevenue;
  return {
    demandScore: explanation.score,
    attendance,
    capacity,
    fillRatePct:
      capacity > 0 ? Math.round((attendance / capacity) * 100) : 0,
    ticketPrice: ops.ticketPrice,
    ticketRevenue,
    merchRevenue,
    concessionsRevenue,
    totalGameDayRevenue,
    revenuePerAttendee: revenuePerAttendee(
      attendance,
      ticketRevenue,
      merchRevenue,
      concessionsRevenue,
    ),
  };
}
