import type { DomainEvent } from "@/domain/events";
import { createDomainEvent } from "@/domain/events";
import type { GameId, TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { createSeededRng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  calculateTicketDemand,
  fanFacilityDemandRaw,
} from "@/systems/demand/calculate-demand";
import {
  premiumCapacityForArena,
  revenuePerAttendee,
} from "@/systems/demand/resolve-attendance";
import { arenaCapacity } from "@/systems/facilities";
import {
  hasAppliedGameplayConsequence,
  withAppliedGameplayConsequence,
} from "@/systems/gameplay-financial-consequences";
import { PROMOTION_VARIANCE_CLAMP } from "@/systems/game-day-promotions/game-day-promotion-config";
import {
  computeGameDaySnapshot,
  type GameDayRevenueSnapshot,
} from "@/systems/game-day-promotions/project-game-day-promotion";
import { resolveGameDayPromotionEffects } from "@/systems/game-day-promotions/resolve-game-day-promotion-effects";
import {
  compactPromotionSummary,
  settleGameDayPromotion,
} from "@/systems/game-day-promotions/settle-game-day-promotion";
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

function snapshotToPostedRevenue(
  state: GameState,
  teamId: TeamId,
  year: number,
  snapshot: GameDayRevenueSnapshot,
): { state: GameState; events: DomainEvent[] } {
  const events: DomainEvent[] = [];
  let current = state;

  if (snapshot.ticketRevenue > 0) {
    const ticketImpact = applyCashAndBooksImpact(
      current,
      teamId,
      snapshot.ticketRevenue,
      year,
      { revenueCategory: "tickets" },
    );
    current = ticketImpact.state;
    events.push(...ticketImpact.events);
  }

  if (snapshot.premiumRevenue > 0) {
    const premiumImpact = applyCashAndBooksImpact(
      current,
      teamId,
      snapshot.premiumRevenue,
      year,
      { revenueCategory: "premium" },
    );
    current = premiumImpact.state;
    events.push(...premiumImpact.events);
  }

  if (snapshot.merchRevenue > 0) {
    const merchImpact = applyCashAndBooksImpact(
      current,
      teamId,
      snapshot.merchRevenue,
      year,
      { revenueCategory: "merchandise" },
    );
    current = merchImpact.state;
    events.push(...merchImpact.events);
  }

  if (snapshot.concessionsRevenue > 0) {
    const concessionsImpact = applyCashAndBooksImpact(
      current,
      teamId,
      snapshot.concessionsRevenue,
      year,
      { revenueCategory: "concessions" },
    );
    current = concessionsImpact.state;
    events.push(...concessionsImpact.events);
  }

  return { state: current, events };
}

/**
 * Posts ticket, premium, merchandise, and concessions revenue for all final
 * home games on currentDate. Emits HomeGameDaySettled as the historical record.
 *
 * Promotion logic is delegated to the game-day-promotions subsystem.
 * This file remains the orchestrator only.
 */
export function processHomeGameTicketRevenue(
  state: GameState,
  rng?: Rng,
): SystemResult {
  const date = state.world.calendar.currentDate;
  const year = state.competition.season.year;
  const leaguePopularity = state.business.leagueEconomy.popularity;
  const events: DomainEvent[] = [];
  let current = state;
  const localRng = rng ?? createSeededRng(state.meta.rngState);

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

    const baseline = computeGameDaySnapshot(current, teamId, game, {
      demandBoost: 0,
      ticketPriceMultiplier: 1,
      merchMultiplier: 1,
      concessionMultiplier: 1,
    });

    const varianceFactor =
      1 + (localRng.next() * 2 - 1) * PROMOTION_VARIANCE_CLAMP;
    const effects = resolveGameDayPromotionEffects(
      current,
      teamId,
      game,
      varianceFactor,
    );

    const actual = effects
      ? computeGameDaySnapshot(current, teamId, game, {
          demandBoost: effects.demandBoost,
          ticketPriceMultiplier: effects.ticketPriceMultiplier,
          merchMultiplier: effects.merchMultiplier,
          concessionMultiplier: effects.concessionMultiplier,
        })
      : baseline;

    const opponentWinPct = teamWinPct(current, game.awayTeamId);
    const demand = calculateTicketDemand({
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

    const capacity = arenaCapacity(current, teamId);
    const premiumCapacity = premiumCapacityForArena(
      capacity,
      ops.facilities.arena.level,
    );

    const posted = snapshotToPostedRevenue(current, teamId, year, actual);
    current = posted.state;
    events.push(...posted.events);

    let promotionSummary:
      | ReturnType<typeof compactPromotionSummary>
      | undefined;

    if (effects) {
      const settled = settleGameDayPromotion(
        current,
        teamId,
        game,
        baseline,
        actual,
        effects,
        varianceFactor - 1,
      );
      current = settled.state;
      events.push(...settled.events);
      const result =
        current.business.gameDayPromotionsByTeamId[teamId]?.results[game.id];
      if (result) {
        promotionSummary = compactPromotionSummary(result);
      }
    }

    events.push(
      createDomainEvent({
        type: "HomeGameDaySettled",
        occurredOn: date,
        payload: {
          teamId,
          gameId: game.id,
          attendance: actual.attendance,
          gaAttendance: actual.gaAttendance,
          premiumOccupancy: actual.premiumOccupancy,
          capacity,
          premiumCapacity,
          demandScore: actual.demandScore,
          ticketPrice: ops.ticketPrice,
          premiumTicketPrice: ops.premiumTicketPrice,
          ticketRevenue: actual.ticketRevenue,
          premiumRevenue: actual.premiumRevenue,
          merchRevenue: actual.merchRevenue,
          concessionsRevenue: actual.concessionsRevenue,
          revenuePerAttendee: revenuePerAttendee(
            actual.attendance,
            actual.ticketRevenue,
            actual.merchRevenue,
            actual.concessionsRevenue,
            actual.premiumRevenue,
          ),
          contributions: demand.contributions,
          ...(promotionSummary ? { promotion: promotionSummary } : {}),
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
                [yearKey]: priorAttendance + actual.attendance,
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
