import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  GAMEPLAY_PLAYOFF_QUALIFICATION_REVENUE,
  GAMEPLAY_PLAYOFF_SERIES_WIN_REVENUE,
} from "@/systems/owner-objectives-config";
import {
  hasAppliedGameplayConsequence,
  withAppliedGameplayConsequence,
} from "@/systems/gameplay-financial-consequences";
import { applyCashAndBooksImpact } from "@/systems/team-finances";

/**
 * League-wide playoff bonuses/distributions for ALL teams.
 *
 * Category `playoffs` is playoff-specific franchise income (qualification and
 * series-win bonuses). Actual playoff game gate revenue continues through the
 * normal game-day pipeline (tickets/premium/merchandise/concessions).
 *
 * Idempotent via appliedGameplayConsequenceKeys (keys include teamId).
 */
export function processLeaguePlayoffBonuses(state: GameState): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
  const seasonYear = current.competition.season.year;
  const playoffs = current.competition.playoffs;

  if (playoffs.status === "not_started") {
    return systemResult(current);
  }

  const qualifiedIds = playoffs.qualifiedTeams.map((seed) => seed.teamId);

  for (const teamId of qualifiedIds) {
    const key = `playoff_qualification:${teamId}:${seasonYear}`;
    if (hasAppliedGameplayConsequence(current, key)) {
      continue;
    }
    const impact = applyCashAndBooksImpact(
      current,
      teamId as TeamId,
      GAMEPLAY_PLAYOFF_QUALIFICATION_REVENUE,
      seasonYear,
      { revenueCategory: "playoffs" },
    );
    current = withAppliedGameplayConsequence(impact.state, key);
    events.push(...impact.events);
  }

  for (const series of playoffs.series) {
    if (series.status !== "complete" || !series.winnerTeamId) {
      continue;
    }
    const teamId = series.winnerTeamId as TeamId;
    const key = `playoff_series_win:${teamId}:${seasonYear}:${series.round}`;
    if (hasAppliedGameplayConsequence(current, key)) {
      continue;
    }
    const impact = applyCashAndBooksImpact(
      current,
      teamId,
      GAMEPLAY_PLAYOFF_SERIES_WIN_REVENUE,
      seasonYear,
      { revenueCategory: "playoffs" },
    );
    current = withAppliedGameplayConsequence(impact.state, key);
    events.push(...impact.events);
  }

  return systemResult(current, events);
}
