import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  AWARD_ELIGIBILITY_CONFIG,
  scaleSeasonMinimums,
} from "@/systems/awards/awards-config";
import {
  getPrimaryLeagueFinalGames,
  type PeriodPlayerAgg,
} from "@/systems/awards/award-stat-sources";

/**
 * ROY games/minutes for this league's season length. Earlier seasons are
 * judged by today's length too: a league that changed its schedule length in
 * an offseason measures its old seasons by the new one.
 */
function rookieMinimums(state: GameState) {
  return scaleSeasonMinimums(
    {
      minGames: AWARD_ELIGIBILITY_CONFIG.rookieOfYear.minGames,
      minMinutes: AWARD_ELIGIBILITY_CONFIG.rookieOfYear.minMinutes,
    },
    state.settings.regularSeason.gamesPerTeam,
  );
}

function hasPriorQualifyingPrimarySeason(
  state: GameState,
  playerId: PlayerId,
  beforeSeasonYear: number,
): boolean {
  const { minGames, minMinutes } = rookieMinimums(state);
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
  const { minGames, minMinutes } = rookieMinimums(state);

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
function isRookieClassPlayer(
  state: GameState,
  playerId: PlayerId,
  seasonYear: number,
): boolean {
  const player = state.world.players[playerId];
  if (!player) return false;
  const draftYear = player.developmentLeague?.draftSeasonYear ?? null;
  if (draftYear != null) {
    return draftYear === seasonYear;
  }
  return player.age <= AWARD_ELIGIBILITY_CONFIG.rookieOfYear.maxAge;
}

export function isRookieEligible(
  state: GameState,
  playerId: PlayerId,
  seasonYear: number,
): boolean {
  if (!isRookieClassPlayer(state, playerId, seasonYear)) {
    return false;
  }
  if (hasPriorQualifyingPrimarySeason(state, playerId, seasonYear)) {
    return false;
  }
  if (state.competition.season.year !== seasonYear) {
    const history = state.business.playerHistory[playerId];
    const season = history?.seasons.find((s) => s.seasonYear === seasonYear);
    return (season?.competition.regular.games ?? 0) > 0;
  }
  return currentSeasonAppearances(state).has(playerId);
}

const appearancesByState = new WeakMap<GameState, Set<string>>();

/**
 * Players who got on the floor in this season's regular-season games. Cached
 * per state: award pools check every player, and the weekly award race runs
 * several pools against the same state.
 */
function currentSeasonAppearances(state: GameState): Set<string> {
  let appeared = appearancesByState.get(state);
  if (!appeared) {
    appeared = new Set();
    const games = getPrimaryLeagueFinalGames(state, {
      seasonId: state.competition.season.id,
      competitionTypes: ["regular_season"],
    });
    for (const game of games) {
      for (const row of game.playerStats) {
        if (row.minutes > 0 || row.points > 0) appeared.add(row.playerId);
      }
    }
    appearancesByState.set(state, appeared);
  }
  return appeared;
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

/** `minimums` default to the full-season config (scale them for short seasons). */
export function isSixthManEligible(
  agg: PeriodPlayerAgg,
  minimums: {
    minGames: number;
    minMinutes: number;
  } = AWARD_ELIGIBILITY_CONFIG.sixthMan,
): boolean {
  if (!meetsMinGamesMinutes(agg, minimums.minGames, minimums.minMinutes)) {
    return false;
  }
  return sixthManStartPct(agg) <= AWARD_ELIGIBILITY_CONFIG.sixthMan.maxStartPct;
}
