import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  GAMEPLAY_LOSS_EXPENSE,
  GAMEPLAY_OBJECTIVE_PENALTY,
  GAMEPLAY_OBJECTIVE_REWARD,
  GAMEPLAY_PLAYOFF_QUALIFICATION_REVENUE,
  GAMEPLAY_PLAYOFF_SERIES_WIN_REVENUE,
  GAMEPLAY_WIN_REVENUE,
} from "@/systems/owner-objectives-config";
import { applyCashAndBooksImpact } from "@/systems/team-finances";

export function hasAppliedGameplayConsequence(
  state: GameState,
  key: string,
): boolean {
  return state.user.appliedGameplayConsequenceKeys[key] === true;
}

export function withAppliedGameplayConsequence(
  state: GameState,
  key: string,
): GameState {
  if (state.user.appliedGameplayConsequenceKeys[key] === true) {
    return state;
  }
  return {
    ...state,
    user: {
      ...state.user,
      appliedGameplayConsequenceKeys: {
        ...state.user.appliedGameplayConsequenceKeys,
        [key]: true,
      },
    },
  };
}

/**
 * Applies owner-team performance and objective financial consequences.
 * Uses deterministic keys in user.appliedGameplayConsequenceKeys for idempotency.
 * Notifications are never consulted for money guards.
 *
 * Safe to call before and after objective evaluation: newly completed/failed
 * objectives are paid on the later pass; already-keyed posts are skipped.
 */
export function applyGameplayFinancialConsequences(
  state: GameState,
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
  const teamId = current.user.controlledTeamId;
  const seasonYear = current.competition.season.year;
  const date = current.world.calendar.currentDate;

  for (const game of Object.values(current.competition.games)) {
    if (game.status !== "final" || game.date !== date) {
      continue;
    }
    const isHome = game.homeTeamId === teamId;
    const isAway = game.awayTeamId === teamId;
    if (!isHome && !isAway) {
      continue;
    }
    const key = `game_result:${teamId}:${game.id}`;
    if (hasAppliedGameplayConsequence(current, key)) {
      continue;
    }
    const userScore = isHome ? game.score.home : game.score.away;
    const oppScore = isHome ? game.score.away : game.score.home;
    const won = userScore > oppScore;
    const amount = won ? GAMEPLAY_WIN_REVENUE : -GAMEPLAY_LOSS_EXPENSE;
    const impact = applyCashAndBooksImpact(current, teamId, amount, seasonYear, {
      revenueCategory: "tickets",
      expenseCategory: "operations",
    });
    current = withAppliedGameplayConsequence(impact.state, key);
    events.push(...impact.events);
  }

  const playoffs = current.competition.playoffs;
  if (
    playoffs.qualifiedTeams.some((seed) => seed.teamId === teamId) &&
    playoffs.status !== "not_started"
  ) {
    const key = `playoff_qualification:${teamId}:${seasonYear}`;
    if (!hasAppliedGameplayConsequence(current, key)) {
      const impact = applyCashAndBooksImpact(
        current,
        teamId,
        GAMEPLAY_PLAYOFF_QUALIFICATION_REVENUE,
        seasonYear,
        { revenueCategory: "other" },
      );
      current = withAppliedGameplayConsequence(impact.state, key);
      events.push(...impact.events);
    }
  }

  for (const series of playoffs.series) {
    if (series.status !== "complete" || series.winnerTeamId !== teamId) {
      continue;
    }
    const key = `playoff_series_win:${teamId}:${seasonYear}:${series.round}`;
    if (hasAppliedGameplayConsequence(current, key)) {
      continue;
    }
    const impact = applyCashAndBooksImpact(
      current,
      teamId,
      GAMEPLAY_PLAYOFF_SERIES_WIN_REVENUE,
      seasonYear,
      { revenueCategory: "other" },
    );
    current = withAppliedGameplayConsequence(impact.state, key);
    events.push(...impact.events);
  }

  for (const objective of current.user.objectives) {
    if (objective.consequenceApplied || objective.status === "active") {
      continue;
    }
    if (objective.status === "completed") {
      const rewardKey = `objective_reward:${objective.id}`;
      if (!hasAppliedGameplayConsequence(current, rewardKey)) {
        const impact = applyCashAndBooksImpact(
          current,
          teamId,
          GAMEPLAY_OBJECTIVE_REWARD,
          seasonYear,
          { revenueCategory: "other" },
        );
        current = withAppliedGameplayConsequence(impact.state, rewardKey);
        events.push(...impact.events);
      }
      current = markObjectiveConsequenceApplied(current, objective.id);
      continue;
    }
    if (objective.status === "failed") {
      const penaltyKey = `objective_penalty:${objective.id}`;
      if (!hasAppliedGameplayConsequence(current, penaltyKey)) {
        const impact = applyCashAndBooksImpact(
          current,
          teamId,
          -GAMEPLAY_OBJECTIVE_PENALTY,
          seasonYear,
          { expenseCategory: "operations" },
        );
        current = withAppliedGameplayConsequence(impact.state, penaltyKey);
        events.push(...impact.events);
      }
      current = markObjectiveConsequenceApplied(current, objective.id);
    }
  }

  return systemResult(current, events);
}

function markObjectiveConsequenceApplied(
  state: GameState,
  objectiveId: string,
): GameState {
  return {
    ...state,
    user: {
      ...state.user,
      objectives: state.user.objectives.map((objective) =>
        objective.id === objectiveId
          ? { ...objective, consequenceApplied: true }
          : objective,
      ),
    },
  };
}

export function gameResultConsequenceKey(
  teamId: TeamId,
  gameId: string,
): string {
  return `game_result:${teamId}:${gameId}`;
}
