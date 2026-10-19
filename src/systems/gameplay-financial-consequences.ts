import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  getActiveOwnerTeamId,
  getOwnedFranchise,
  getOwnedTeamIds,
  withOwnedFranchise,
} from "@/state/owner-context";
import {
  GAMEPLAY_LOSS_EXPENSE,
  GAMEPLAY_OBJECTIVE_PENALTY,
  GAMEPLAY_OBJECTIVE_REWARD,
  objectiveAppliesCashConsequence,
} from "@/systems/owner-objectives-config";
import { applyCashAndBooksImpact } from "@/systems/team-finances";

export function hasAppliedGameplayConsequence(
  state: GameState,
  key: string,
  teamId?: TeamId,
): boolean {
  // Simulation-side fallback: prefer explicit teamId. ownedTeamIds[0] is not UI
  // "Your Team" context — callers that own multiple franchises must pass teamId.
  const targetId = teamId ?? state.user.ownedTeamIds[0];
  if (!targetId) {
    return false;
  }
  const franchise = state.user.ownedFranchises[targetId];
  return franchise?.appliedGameplayConsequenceKeys[key] === true;
}

export function withAppliedGameplayConsequence(
  state: GameState,
  key: string,
  teamId?: TeamId,
): GameState {
  // Same multi-franchise rule as hasAppliedGameplayConsequence — not activeOwnerTeamId.
  const targetId =
    teamId ?? state.user.ownedTeamIds[0] ?? getActiveOwnerTeamId(state);
  const franchise = state.user.ownedFranchises[targetId];
  if (!franchise) {
    return state;
  }
  if (franchise.appliedGameplayConsequenceKeys[key] === true) {
    return state;
  }
  return withOwnedFranchise(state, targetId, (current) => ({
    ...current,
    appliedGameplayConsequenceKeys: {
      ...current.appliedGameplayConsequenceKeys,
      [key]: true,
    },
  }));
}

/**
 * Applies owner-team performance and objective financial consequences.
 * Uses deterministic keys in franchise.appliedGameplayConsequenceKeys for idempotency.
 * Notifications are never consulted for money guards.
 *
 * Safe to call before and after objective evaluation: newly completed/failed
 * objectives are paid on the later pass; already-keyed posts are skipped.
 *
 * Runs for every owned franchise (online leagues own several), each keyed on
 * its own franchise, not just the active owner team.
 */
export function applyGameplayFinancialConsequences(
  state: GameState,
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
  for (const teamId of getOwnedTeamIds(state)) {
    const applied = applyTeamGameplayConsequences(current, teamId);
    current = applied.state;
    events.push(...applied.events);
  }
  return systemResult(current, events);
}

function applyTeamGameplayConsequences(
  state: GameState,
  teamId: TeamId,
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
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
    if (hasAppliedGameplayConsequence(current, key, teamId)) {
      continue;
    }
    const userScore = isHome ? game.score.home : game.score.away;
    const oppScore = isHome ? game.score.away : game.score.home;
    const won = userScore > oppScore;
    if (!won) {
      const amount = -GAMEPLAY_LOSS_EXPENSE;
      const impact = applyCashAndBooksImpact(
        current,
        teamId,
        amount,
        seasonYear,
        {
          expenseCategory: "operations",
        },
      );
      current = withAppliedGameplayConsequence(impact.state, key, teamId);
      events.push(...impact.events);
    } else {
      current = withAppliedGameplayConsequence(current, key, teamId);
    }
  }

  // Playoff qualification / series-win bonuses are league-wide — see
  // processLeaguePlayoffBonuses. Owner module only handles user loss fees
  // and objective cash consequences.

  for (const objective of getOwnedFranchise(current, teamId).objectives) {
    if (objective.consequenceApplied || objective.status === "active") {
      continue;
    }
    const applyCash = objectiveAppliesCashConsequence(objective.type);
    if (objective.status === "completed") {
      if (applyCash) {
        const rewardKey = `objective_reward:${objective.id}`;
        if (!hasAppliedGameplayConsequence(current, rewardKey, teamId)) {
          const impact = applyCashAndBooksImpact(
            current,
            teamId,
            GAMEPLAY_OBJECTIVE_REWARD,
            seasonYear,
            { revenueCategory: "other" },
          );
          current = withAppliedGameplayConsequence(
            impact.state,
            rewardKey,
            teamId,
          );
          events.push(...impact.events);
        }
      }
      current = markObjectiveConsequenceApplied(current, objective.id, teamId);
      continue;
    }
    if (objective.status === "failed") {
      if (applyCash) {
        const penaltyKey = `objective_penalty:${objective.id}`;
        if (!hasAppliedGameplayConsequence(current, penaltyKey, teamId)) {
          const impact = applyCashAndBooksImpact(
            current,
            teamId,
            -GAMEPLAY_OBJECTIVE_PENALTY,
            seasonYear,
            { expenseCategory: "operations" },
          );
          current = withAppliedGameplayConsequence(
            impact.state,
            penaltyKey,
            teamId,
          );
          events.push(...impact.events);
        }
      }
      current = markObjectiveConsequenceApplied(current, objective.id, teamId);
    }
  }

  return systemResult(current, events);
}

function markObjectiveConsequenceApplied(
  state: GameState,
  objectiveId: string,
  teamId: TeamId,
): GameState {
  return withOwnedFranchise(state, teamId, (franchise) => ({
    ...franchise,
    objectives: franchise.objectives.map((objective) =>
      objective.id === objectiveId
        ? { ...objective, consequenceApplied: true }
        : objective,
    ),
  }));
}

export function gameResultConsequenceKey(
  teamId: TeamId,
  gameId: string,
): string {
  return `game_result:${teamId}:${gameId}`;
}
