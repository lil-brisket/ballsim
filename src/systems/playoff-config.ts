/**
 * Playoff field size and series configuration for v1.
 * Field size is derived from league size; series length is best-of-7.
 */

export const MIN_PLAYOFF_LEAGUE_SIZE = 4;
export const MAX_PLAYOFF_FIELD_SIZE = 64;
/** @deprecated Prefer seriesWinsToClinch from game settings; kept for legacy callers. */
export const SERIES_WINS_TO_CLINCH = 4;

/** Supported bracket sizes including non-power-of-2 fields with byes. */
export const SUPPORTED_PLAYOFF_FIELD_SIZES = [4, 6, 8, 12, 16, 32, 64] as const;

/**
 * Legacy field-size derivation (pre-settings): largest power of 2 <= teamCount,
 * at least 8, capped at 64. Returns 0 when the league is too small.
 * Used only for migrating old saves; new code reads settings.playoffs.playoffTeams.
 */
export function getLegacyPlayoffTeamCount(teamCount: number): number {
  if (!Number.isInteger(teamCount) || teamCount < 0) {
    throw new Error(
      `getLegacyPlayoffTeamCount teamCount must be a non-negative integer; got ${teamCount}.`,
    );
  }
  if (teamCount < 8) {
    return 0;
  }
  let fieldSize = MAX_PLAYOFF_FIELD_SIZE;
  while (fieldSize > teamCount) {
    fieldSize = fieldSize / 2;
  }
  if (fieldSize < 8) {
    return 0;
  }
  return fieldSize;
}

/**
 * @deprecated Use settings.playoffs.playoffTeams. Kept as alias for migration helpers.
 */
export function getPlayoffTeamCount(teamCount: number): number {
  return getLegacyPlayoffTeamCount(teamCount);
}

/**
 * Home court patterns by series length (0-based game index).
 * H = higher original seed, L = lower original seed.
 */
const HOME_PATTERNS: Record<1 | 3 | 5 | 7, ReadonlySet<number>> = {
  1: new Set([0]),
  3: new Set([0, 2]),
  5: new Set([0, 1, 4]),
  7: new Set([0, 1, 4, 6]),
};

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
  seriesLength: 1 | 3 | 5 | 7 = 7,
): string {
  const maxIndex = seriesLength - 1;
  if (!Number.isInteger(gameIndex) || gameIndex < 0 || gameIndex > maxIndex) {
    throw new Error(
      `getHomeTeamForGame gameIndex must be an integer 0..${maxIndex} for best-of-${seriesLength}; got ${gameIndex}.`,
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
  const higherHome = HOME_PATTERNS[seriesLength];
  return higherHome.has(gameIndex)
    ? series.higherSeedTeamId
    : series.lowerSeedTeamId;
}
