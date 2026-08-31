import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { AWARD_ELIGIBILITY_CONFIG } from "@/systems/awards/awards-config";
import {
  getPrimaryLeagueFinalGames,
  type PeriodPlayerAgg,
} from "@/systems/awards/award-stat-sources";

function hasPriorQualifyingPrimarySeason(
  state: GameState,
  playerId: PlayerId,
  beforeSeasonYear: number,
): boolean {
  const minGames = AWARD_ELIGIBILITY_CONFIG.rookieOfYear.minGames;
  const minMinutes = AWARD_ELIGIBILITY_CONFIG.rookieOfYear.minMinutes;
  const history = state.business.playerHistory[playerId];
  if (!history) return false;
  return history.seasons.some((season) => {
    if (season.seasonYear >= beforeSeasonYear) return false;
    const regular = season.competition.regular;
    return regular.games >= minGames && regular.minutes >= minMinutes;
  });
}

/**
 * First season year with a qualifying primary-league regular-season appearance.
 * Developmental-league games never consume rookie eligibility.
 */
export function getPlayerRookieSeasonYear(
  state: GameState,
  playerId: PlayerId,
): number | null {
  const minGames = AWARD_ELIGIBILITY_CONFIG.rookieOfYear.minGames;
  const minMinutes = AWARD_ELIGIBILITY_CONFIG.rookieOfYear.minMinutes;

  const history = state.business.playerHistory[playerId];
  if (history) {
    const sorted = [...history.seasons].sort(
      (a, b) => a.seasonYear - b.seasonYear,
    );
    for (const season of sorted) {
      const regular = season.competition.regular;
      if (regular.games >= minGames && regular.minutes >= minMinutes) {
        return season.seasonYear;
      }
    }
  }

  const currentYear = state.competition.season.year;
  if (hasPriorQualifyingPrimarySeason(state, playerId, currentYear)) {
    return null;
  }

  const games = getPrimaryLeagueFinalGames(state, {
    seasonId: state.competition.season.id,
    competitionTypes: ["regular_season"],
  });
  let gp = 0;
  let minutes = 0;
  for (const game of games) {
    const row = game.playerStats.find((stat) => stat.playerId === playerId);
    if (!row) continue;
    gp += 1;
    minutes += row.minutes;
  }
  if (gp >= minGames && minutes >= minMinutes) {
    return currentYear;
  }

  return null;
}

/**
 * True when this season is the player's first primary-league campaign
 * (no prior qualifying primary season). Mid-season monthly awards use this
 * even before ROY min-games thresholds are met.
 */
export function isRookieEligible(
  state: GameState,
  playerId: PlayerId,
  seasonYear: number,
): boolean {
  if (hasPriorQualifyingPrimarySeason(state, playerId, seasonYear)) {
    return false;
  }
  if (state.competition.season.year !== seasonYear) {
    const history = state.business.playerHistory[playerId];
    const season = history?.seasons.find((s) => s.seasonYear === seasonYear);
    return (season?.competition.regular.games ?? 0) > 0;
  }
  const games = getPrimaryLeagueFinalGames(state, {
    seasonId: state.competition.season.id,
    competitionTypes: ["regular_season"],
  });
  return games.some((game) =>
    game.playerStats.some(
      (row) => row.playerId === playerId && (row.minutes > 0 || row.points > 0),
    ),
  );
}

export function meetsMinGamesMinutes(
  agg: PeriodPlayerAgg,
  minGames: number,
  minMinutes: number,
): boolean {
  return agg.games >= minGames && agg.minutes >= minMinutes;
}

export function sixthManStartPct(agg: PeriodPlayerAgg): number {
  if (agg.games <= 0) return 1;
  return agg.starts / agg.games;
}

export function isSixthManEligible(agg: PeriodPlayerAgg): boolean {
  const cfg = AWARD_ELIGIBILITY_CONFIG.sixthMan;
  if (!meetsMinGamesMinutes(agg, cfg.minGames, cfg.minMinutes)) {
    return false;
  }
  return sixthManStartPct(agg) <= cfg.maxStartPct;
}
