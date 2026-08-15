import type { DomainEvent } from "@/domain/events";
import type { GameId, TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { calculateTicketDemand } from "@/systems/demand/calculate-demand";
import {
  merchandiseFromAttendance,
  resolveAttendance,
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

/**
 * Posts ticket and merchandise revenue for all final home games on currentDate.
 * Idempotent via appliedGameplayConsequenceKeys.
 */
export function processHomeGameTicketRevenue(state: GameState): SystemResult {
  const date = state.world.calendar.currentDate;
  const year = state.competition.season.year;
  const leaguePopularity = state.business.leagueEconomy.popularity;
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

    const demand = calculateTicketDemand({
      marketSize: ops.marketSize,
      fanSentiment: ops.fanSentiment,
      reputation: team.reputation,
      awareness: ops.marketing.awareness,
      mediaAttention: ops.mediaAttention,
      leaguePopularity,
      winPct: teamWinPct(current, teamId),
    });

    const capacity = arenaCapacity(current, teamId);
    const attendance = resolveAttendance(
      demand.score,
      ops.ticketPrice,
      capacity,
    );
    const ticketRevenue = attendance * ops.ticketPrice;
    const merchRevenue = merchandiseFromAttendance(
      attendance,
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

    current = withAppliedGameplayConsequence(current, key);
  }

  return systemResult(current, events);
}
