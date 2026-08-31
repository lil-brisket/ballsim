import type {
  GameDayPromotionAssignment,
  GameDayPromotionSeasonState,
} from "@/domain/entities/game-day-promotion";
import {
  createEmptyGameDayPromotionSeasonState,
} from "@/domain/entities/game-day-promotion";
import type { Game } from "@/domain/entities/game";
import type { DomainEvent } from "@/domain/events";
import { createDomainEvent } from "@/domain/events";
import type { GameId, TeamId } from "@/domain/ids";
import { asSeasonId } from "@/domain/ids";
import { calendarDaysBetween } from "@/domain/calendar-date";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getGameDayPromotionDefinition } from "@/systems/game-day-promotions/game-day-promotion-catalog";
import {
  PROMOTION_FINAL_CANCEL_WINDOW_DAYS,
  PROMOTION_PARTIAL_REFUND_FRACTION,
} from "@/systems/game-day-promotions/game-day-promotion-config";
import { projectGameDayPromotion } from "@/systems/game-day-promotions/project-game-day-promotion";
import {
  applyCashAndBooksImpact,
  assertSufficientBusinessFunds,
} from "@/systems/team-finances";
import { assertCapitalSpendingAllowed } from "@/systems/financial-spending";

function ensurePromoState(
  state: GameState,
  teamId: TeamId,
): GameDayPromotionSeasonState {
  const existing = state.business.gameDayPromotionsByTeamId[teamId];
  if (existing) return existing;
  return createEmptyGameDayPromotionSeasonState(
    asSeasonId(state.competition.season.id),
  );
}

function withPromoState(
  state: GameState,
  teamId: TeamId,
  promoState: GameDayPromotionSeasonState,
): GameState {
  return {
    ...state,
    business: {
      ...state.business,
      gameDayPromotionsByTeamId: {
        ...state.business.gameDayPromotionsByTeamId,
        [teamId]: promoState,
      },
    },
  };
}

function assertHomeScheduledGame(
  state: GameState,
  teamId: TeamId,
  gameId: GameId,
): Game {
  const game = state.competition.games[gameId];
  if (!game) {
    throw new Error(`scheduleGameDayPromotion: game "${gameId}" not found.`);
  }
  if (game.homeTeamId !== teamId) {
    throw new Error(
      `scheduleGameDayPromotion: game "${gameId}" is not a home game for "${teamId}".`,
    );
  }
  if (game.status !== "scheduled") {
    throw new Error(
      `scheduleGameDayPromotion: game "${gameId}" is not scheduled (status=${game.status}).`,
    );
  }
  return game;
}

function isOpeningHomeGame(
  state: GameState,
  teamId: TeamId,
  gameId: GameId,
): boolean {
  const homeGames = Object.values(state.competition.games)
    .filter(
      (g) =>
        g.homeTeamId === teamId &&
        (g.competitionType === "regular_season" ||
          g.competitionType === "playoffs"),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return homeGames[0]?.id === gameId;
}

function computeAssignmentStatus(
  currentDate: string,
  gameDate: string,
  leadTimeDays: number,
): "scheduled" | "committed" {
  const days = calendarDaysBetween(currentDate, gameDate);
  return days < leadTimeDays ? "committed" : "scheduled";
}

export function refundFractionForCancel(
  currentDate: string,
  gameDate: string,
  leadTimeDays: number,
): number {
  const days = calendarDaysBetween(currentDate, gameDate);
  if (days <= PROMOTION_FINAL_CANCEL_WINDOW_DAYS) {
    return 0;
  }
  if (days <= leadTimeDays) {
    return PROMOTION_PARTIAL_REFUND_FRACTION;
  }
  return 1;
}

/**
 * Schedule a game-day promotion for a home game. Charges cost immediately.
 * V1: at most one promotion per home game.
 */
export function scheduleGameDayPromotion(
  state: GameState,
  teamId: TeamId,
  gameId: GameId,
  promotionId: string,
): SystemResult {
  const game = assertHomeScheduledGame(state, teamId, gameId);
  const definition = getGameDayPromotionDefinition(promotionId);
  if (!definition) {
    throw new Error(
      `scheduleGameDayPromotion: unknown promotion "${promotionId}".`,
    );
  }

  const currentDate = state.world.calendar.currentDate;
  const daysToGame = calendarDaysBetween(currentDate, game.date);
  if (daysToGame < definition.leadTimeDays) {
    throw new Error(
      `scheduleGameDayPromotion: requires ${definition.leadTimeDays} days lead time; only ${daysToGame} remain.`,
    );
  }

  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    throw new Error(`scheduleGameDayPromotion: franchiseOps missing for "${teamId}".`);
  }

  let promoState = ensurePromoState(state, teamId);
  const existing = promoState.assignments[gameId];
  if (existing && existing.status !== "cancelled") {
    throw new Error(
      `scheduleGameDayPromotion: game "${gameId}" already has a promotion (v1 one-per-game).`,
    );
  }

  const uses = promoState.usageByPromotionId[promotionId] ?? 0;
  if (uses >= definition.maxUsesPerSeason) {
    throw new Error(
      `scheduleGameDayPromotion: "${promotionId}" reached max uses this season.`,
    );
  }
  const lastUsed = promoState.lastUsedDateByPromotionId[promotionId];
  if (lastUsed) {
    const since = calendarDaysBetween(lastUsed, currentDate);
    if (since < definition.cooldownDays) {
      throw new Error(
        `scheduleGameDayPromotion: "${promotionId}" on cooldown (${definition.cooldownDays - since} days left).`,
      );
    }
  }

  const req = definition.requirements;
  if (req?.minMarketSize != null && ops.marketSize < req.minMarketSize) {
    throw new Error(`scheduleGameDayPromotion: market size too small.`);
  }
  if (req?.minFanSentiment != null && ops.fanSentiment < req.minFanSentiment) {
    throw new Error(`scheduleGameDayPromotion: fan sentiment too low.`);
  }
  if (req?.openingNightOnly && !isOpeningHomeGame(state, teamId, gameId)) {
    throw new Error(
      `scheduleGameDayPromotion: Opening Night is only for the first home game.`,
    );
  }
  if (req?.divisionMatchupOnly) {
    const home = state.world.teams[teamId];
    const away = state.world.teams[game.awayTeamId];
    if (!home || !away || home.divisionId !== away.divisionId) {
      throw new Error(
        `scheduleGameDayPromotion: Rivalry Night requires a divisional opponent.`,
      );
    }
  }

  assertCapitalSpendingAllowed(state, teamId, "Scheduling a game-day promotion");
  assertSufficientBusinessFunds(
    state,
    teamId,
    definition.cost,
    "Scheduling a game-day promotion",
  );

  const projection = projectGameDayPromotion(state, teamId, game, promotionId);
  const year = state.competition.season.year;
  const events: DomainEvent[] = [];
  let current = state;

  if (definition.cost > 0) {
    const impact = applyCashAndBooksImpact(
      current,
      teamId,
      -definition.cost,
      year,
      { expenseCategory: "marketing" },
    );
    current = impact.state;
    events.push(...impact.events);
  }

  promoState = ensurePromoState(current, teamId);
  const assignment: GameDayPromotionAssignment = {
    promotionId,
    gameId,
    scheduledOn: currentDate,
    costPaid: definition.cost,
    status: computeAssignmentStatus(
      currentDate,
      game.date,
      definition.leadTimeDays,
    ),
    projectedSnapshot: projection ?? undefined,
  };

  const nextUsage = { ...promoState.usageByPromotionId };
  nextUsage[promotionId] = (nextUsage[promotionId] ?? 0) + 1;

  const nextState: GameDayPromotionSeasonState = {
    ...promoState,
    seasonId: asSeasonId(current.competition.season.id),
    assignments: {
      ...promoState.assignments,
      [gameId]: assignment,
    },
    usageByPromotionId: nextUsage,
    lastUsedDateByPromotionId: {
      ...promoState.lastUsedDateByPromotionId,
      [promotionId]: currentDate,
    },
    committedSpend: promoState.committedSpend + definition.cost,
  };

  current = withPromoState(current, teamId, nextState);
  events.push(
    createDomainEvent({
      type: "ExpenseRecorded",
      occurredOn: currentDate,
      payload: {
        teamId,
        category: "marketing",
        amount: definition.cost,
        reason: "game_day_promotion_scheduled",
        promotionId,
        gameId,
      },
    }),
  );

  return systemResult(current, events);
}

export function cancelGameDayPromotion(
  state: GameState,
  teamId: TeamId,
  gameId: GameId,
): SystemResult {
  const game = assertHomeScheduledGame(state, teamId, gameId);
  const promoState = ensurePromoState(state, teamId);
  const assignment = promoState.assignments[gameId];
  if (!assignment || assignment.status === "cancelled") {
    throw new Error(
      `cancelGameDayPromotion: no active promotion on game "${gameId}".`,
    );
  }
  if (assignment.status === "completed") {
    throw new Error(`cancelGameDayPromotion: promotion already completed.`);
  }

  const definition = getGameDayPromotionDefinition(assignment.promotionId);
  const leadTime = definition?.leadTimeDays ?? 7;
  const currentDate = state.world.calendar.currentDate;
  const fraction = refundFractionForCancel(currentDate, game.date, leadTime);
  const refund = Math.round(assignment.costPaid * fraction);
  const year = state.competition.season.year;
  const events: DomainEvent[] = [];
  let current = state;

  if (refund > 0) {
    const impact = applyCashAndBooksImpact(current, teamId, refund, year, {
      revenueCategory: "other",
    });
    current = impact.state;
    events.push(...impact.events);
  }

  const latest = ensurePromoState(current, teamId);
  const { [gameId]: _removed, ...restAssignments } = latest.assignments;
  const nextUsage = { ...latest.usageByPromotionId };
  if (assignment.promotionId in nextUsage) {
    nextUsage[assignment.promotionId] = Math.max(
      0,
      (nextUsage[assignment.promotionId] ?? 1) - 1,
    );
  }

  current = withPromoState(current, teamId, {
    ...latest,
    assignments: restAssignments,
    usageByPromotionId: nextUsage,
    committedSpend: Math.max(0, latest.committedSpend - assignment.costPaid),
  });

  return systemResult(current, events);
}

export function changeGameDayPromotion(
  state: GameState,
  teamId: TeamId,
  gameId: GameId,
  newPromotionId: string,
): SystemResult {
  const cancelled = cancelGameDayPromotion(state, teamId, gameId);
  const scheduled = scheduleGameDayPromotion(
    cancelled.state,
    teamId,
    gameId,
    newPromotionId,
  );
  return systemResult(scheduled.state, [
    ...cancelled.events,
    ...scheduled.events,
  ]);
}

/** Recompute scheduled vs committed statuses for a team (optional daily polish). */
export function refreshPromotionAssignmentStatuses(
  state: GameState,
  teamId: TeamId,
): GameState {
  const promoState = state.business.gameDayPromotionsByTeamId[teamId];
  if (!promoState) return state;
  const currentDate = state.world.calendar.currentDate;
  let changed = false;
  const assignments = { ...promoState.assignments };
  for (const [gameId, assignment] of Object.entries(assignments)) {
    if (assignment.status !== "scheduled" && assignment.status !== "committed") {
      continue;
    }
    const game = state.competition.games[gameId];
    const definition = getGameDayPromotionDefinition(assignment.promotionId);
    if (!game || !definition) continue;
    const next = computeAssignmentStatus(
      currentDate,
      game.date,
      definition.leadTimeDays,
    );
    if (next !== assignment.status) {
      assignments[gameId] = { ...assignment, status: next };
      changed = true;
    }
  }
  if (!changed) return state;
  return withPromoState(state, teamId, { ...promoState, assignments });
}
