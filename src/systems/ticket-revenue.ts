import type { DomainEvent } from "@/domain/events";
import { createDomainEvent } from "@/domain/events";
import type { GameId, TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  calculateTicketDemand,
  fanFacilityDemandRaw,
} from "@/systems/demand/calculate-demand";
import {
  PLAYOFF_DEMAND_UPLIFT,
} from "@/systems/demand/demand-config";
import {
  allocateGameDaySeats,
  applyConsumerCycleToDemandScore,
  applyPlayoffDemandUplift,
  concessionsFromAttendance,
  merchandiseFromAttendance,
  premiumCapacityForArena,
  resolvePremiumOccupancy,
  revenuePerAttendee,
  starMerchandiseFactor,
} from "@/systems/demand/resolve-attendance";
import { arenaCapacity } from "@/systems/facilities";
import {
  hasAppliedGameplayConsequence,
  withAppliedGameplayConsequence,
} from "@/systems/gameplay-financial-consequences";
import { applyCashAndBooksImpact } from "@/systems/team-finances";

export function ticketRevenueConsequenceKey(
  teamId: TeamId,
  gameId: GameId,
): string {
  return `tickets:${teamId}:${gameId}`;
}

function teamWinPct(state: GameState, teamId: TeamId): number {
  const standing = state.competition.standings.byTeamId[teamId];
  if (!standing) {
    return 0.5;
  }
  const games = standing.wins + standing.losses;
  return games === 0 ? 0.5 : standing.wins / games;
}

function rosterStarAverage(state: GameState, teamId: TeamId): number {
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
 * Posts ticket, premium, merchandise, and concessions revenue for all final
 * home games on currentDate. Emits HomeGameDaySettled as the historical record.
 * Accumulates durable season attendance on finances.attendanceByYear (regular
 * + playoff home games). Idempotent via appliedGameplayConsequenceKeys —
 * retries must not double-count attendance or revenue.
 *
 * Seat allocation: premium first, then GA against remaining capacity.
 * Playoff bonuses are NOT booked here — see processLeaguePlayoffBonuses.
 */
export function processHomeGameTicketRevenue(state: GameState): SystemResult {
  const date = state.world.calendar.currentDate;
  const year = state.competition.season.year;
  const leaguePopularity = state.business.leagueEconomy.popularity;
  const cycle = state.business.leagueEconomy.cycle;
  const inPlayoffs =
    state.competition.playoffs.status === "in_progress" ||
    state.competition.playoffs.status === "complete";
  const events: DomainEvent[] = [];
  let current = state;

  for (const game of Object.values(current.competition.games)) {
    if (game.status !== "final" || game.date !== date) {
      continue;
    }
    const teamId = game.homeTeamId;
    const key = ticketRevenueConsequenceKey(teamId, game.id);
    if (hasAppliedGameplayConsequence(current, key)) {
      continue;
    }

    const ops = current.business.franchiseOps[teamId];
    const team = current.world.teams[teamId];
    if (!ops || !team) {
      continue;
    }

    const opponentWinPct = teamWinPct(current, game.awayTeamId);
    let demand = calculateTicketDemand({
      marketSize: ops.marketSize,
      fanSentiment: ops.fanSentiment,
      reputation: team.reputation,
      awareness: ops.marketing.awareness,
      mediaAttention: ops.mediaAttention,
      leaguePopularity,
      winPct: teamWinPct(current, teamId),
      fanFacility: fanFacilityDemandRaw(ops.facilities.fan.level),
      opponentWinPct,
    });

    let demandScore = applyConsumerCycleToDemandScore(demand.score, cycle);
    if (inPlayoffs) {
      demandScore = applyPlayoffDemandUplift(demandScore, PLAYOFF_DEMAND_UPLIFT);
    }

    const capacity = arenaCapacity(current, teamId);
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
    const starFactor = starMerchandiseFactor(
      rosterStarAverage(current, teamId),
    );
    const totalAttendance = seats.gaAttendance + seats.premiumOccupancy;
    const merchRevenue = merchandiseFromAttendance(
      totalAttendance,
      ops.fanSentiment,
      starFactor,
    );
    const concessionsRevenue = concessionsFromAttendance(
      totalAttendance,
      ops.fanSentiment,
    );

    if (ticketRevenue > 0) {
      const ticketImpact = applyCashAndBooksImpact(
        current,
        teamId,
        ticketRevenue,
        year,
        { revenueCategory: "tickets" },
      );
      current = ticketImpact.state;
      events.push(...ticketImpact.events);
    }

    if (premiumRevenue > 0) {
      const premiumImpact = applyCashAndBooksImpact(
        current,
        teamId,
        premiumRevenue,
        year,
        { revenueCategory: "premium" },
      );
      current = premiumImpact.state;
      events.push(...premiumImpact.events);
    }

    if (merchRevenue > 0) {
      const merchImpact = applyCashAndBooksImpact(
        current,
        teamId,
        merchRevenue,
        year,
        { revenueCategory: "merchandise" },
      );
      current = merchImpact.state;
      events.push(...merchImpact.events);
    }

    if (concessionsRevenue > 0) {
      const concessionsImpact = applyCashAndBooksImpact(
        current,
        teamId,
        concessionsRevenue,
        year,
        { revenueCategory: "concessions" },
      );
      current = concessionsImpact.state;
      events.push(...concessionsImpact.events);
    }

    events.push(
      createDomainEvent({
        type: "HomeGameDaySettled",
        occurredOn: date,
        payload: {
          teamId,
          gameId: game.id,
          attendance: totalAttendance,
          gaAttendance: seats.gaAttendance,
          premiumOccupancy: seats.premiumOccupancy,
          capacity,
          premiumCapacity,
          demandScore,
          ticketPrice: ops.ticketPrice,
          premiumTicketPrice: ops.premiumTicketPrice,
          ticketRevenue,
          premiumRevenue,
          merchRevenue,
          concessionsRevenue,
          revenuePerAttendee: revenuePerAttendee(
            totalAttendance,
            ticketRevenue,
            merchRevenue,
            concessionsRevenue,
            premiumRevenue,
          ),
          contributions: demand.contributions,
        },
      }),
    );

    const yearKey = String(year);
    const finances = current.business.finances[teamId];
    if (finances) {
      const priorAttendance = finances.attendanceByYear[yearKey] ?? 0;
      current = {
        ...current,
        business: {
          ...current.business,
          finances: {
            ...current.business.finances,
            [teamId]: {
              ...finances,
              attendanceByYear: {
                ...finances.attendanceByYear,
                [yearKey]: priorAttendance + totalAttendance,
              },
            },
          },
        },
      };
    }

    current = withAppliedGameplayConsequence(current, key);
  }

  return systemResult(current, events);
}
