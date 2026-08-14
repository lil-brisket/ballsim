/**
 * Playoff field size and series configuration for v1.
 * Field size is derived from league size; series length is best-of-7.
 */

export const MIN_PLAYOFF_LEAGUE_SIZE = 8;
export const MAX_PLAYOFF_FIELD_SIZE = 64;
export const SERIES_WINS_TO_CLINCH = 4;

/** Supported bracket sizes (powers of 2 from 8 through 64). */
export const SUPPORTED_PLAYOFF_FIELD_SIZES = [8, 16, 32, 64] as const;

/**
 * Largest power of 2 that is <= teamCount, at least 8, capped at 64.
 * Returns 0 when the league is too small for playoffs.
 */
export function getPlayoffTeamCount(teamCount: number): number {
  if (!Number.isInteger(teamCount) || teamCount < 0) {
    throw new Error(
      `getPlayoffTeamCount teamCount must be a non-negative integer; got ${teamCount}.`,
    );
  }
  if (teamCount < MIN_PLAYOFF_LEAGUE_SIZE) {
    return 0;
  }
  let fieldSize = MAX_PLAYOFF_FIELD_SIZE;
  while (fieldSize > teamCount) {
    fieldSize = fieldSize / 2;
  }
  if (fieldSize < MIN_PLAYOFF_LEAGUE_SIZE) {
    return 0;
  }
  return fieldSize;
}

/**
 * Best-of-7 home pattern (0-based game index): H, H, L, L, H, L, H
 * where H = higher original seed, L = lower original seed.
 */
const HIGHER_SEED_HOME_GAME_INDEXES = new Set([0, 1, 4, 6]);

export type HomeCourtSeriesParticipants = {
  higherSeedTeamId: string;
  lowerSeedTeamId: string;
};

/**
 * Returns which team hosts the given series game.
 * Seed determines bracket position; this function alone assigns home court.
 */
export function getHomeTeamForGame(
  series: HomeCourtSeriesParticipants,
  gameIndex: number,
): string {
  if (!Number.isInteger(gameIndex) || gameIndex < 0 || gameIndex > 6) {
    throw new Error(
      `getHomeTeamForGame gameIndex must be an integer 0..6; got ${gameIndex}.`,
    );
  }
  if (!series.higherSeedTeamId || !series.lowerSeedTeamId) {
    throw new Error(
      "getHomeTeamForGame requires both higherSeedTeamId and lowerSeedTeamId.",
    );
  }
  if (series.higherSeedTeamId === series.lowerSeedTeamId) {
    throw new Error(
      "getHomeTeamForGame higherSeedTeamId and lowerSeedTeamId must differ.",
    );
  }
  return HIGHER_SEED_HOME_GAME_INDEXES.has(gameIndex)
    ? series.higherSeedTeamId
    : series.lowerSeedTeamId;
}
