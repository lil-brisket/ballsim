import type { TeamId } from "@/domain/ids";

export const MIN_TEAM_COUNT = 2;

/**
 * Input for the pure season schedule generator.
 * `seasonLength` is games per team (not calendar days or rounds).
 */
export type SeasonScheduleConfig = {
  teamIds: readonly TeamId[];
  seasonLength: number;
};

/**
 * One scheduled contest before calendar dates are assigned.
 * `round` is 1-based; games in the same round share a time slot.
 */
export type SeasonScheduleAssignment = {
  round: number;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
};

/** Double round-robin: every team plays every other team twice (home and away). */
export function defaultSeasonLength(teamCount: number): number {
  if (!Number.isInteger(teamCount) || teamCount < MIN_TEAM_COUNT) {
    throw new Error(
      `defaultSeasonLength teamCount must be an integer >= ${MIN_TEAM_COUNT}.`,
    );
  }
  return 2 * (teamCount - 1);
}

/**
 * Number of discrete rounds for a valid config.
 * Even n: one game per team per round → rounds = seasonLength.
 * Odd n: one bye per round → rounds = (n * seasonLength) / (n - 1).
 */
export function expectedRoundCount(
  teamCount: number,
  seasonLength: number,
): number {
  if (!Number.isInteger(teamCount) || teamCount < MIN_TEAM_COUNT) {
    throw new Error(
      `expectedRoundCount teamCount must be an integer >= ${MIN_TEAM_COUNT}.`,
    );
  }
  if (!Number.isInteger(seasonLength) || seasonLength < 1) {
    throw new Error(
      "expectedRoundCount seasonLength must be an integer >= 1.",
    );
  }
  if (teamCount % 2 === 0) {
    return seasonLength;
  }
  if (seasonLength % (teamCount - 1) !== 0) {
    throw new Error(
      `expectedRoundCount: for ${teamCount} teams, seasonLength must be a multiple of ${teamCount - 1}.`,
    );
  }
  return (teamCount * seasonLength) / (teamCount - 1);
}

/**
 * Validates season schedule config and returns a normalized copy with sorted unique team IDs.
 * Throws Error on impossible configurations.
 */
export function validateSeasonScheduleConfig(
  config: SeasonScheduleConfig,
): { teamIds: TeamId[]; seasonLength: number } {
  const { teamIds, seasonLength } = config;

  if (!Array.isArray(teamIds)) {
    throw new Error("Season schedule teamIds must be an array.");
  }
  if (teamIds.length < MIN_TEAM_COUNT) {
    throw new Error(
      `Season schedule requires at least ${MIN_TEAM_COUNT} teams.`,
    );
  }
  for (let i = 0; i < teamIds.length; i += 1) {
    const id = teamIds[i];
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(
        `Season schedule teamIds[${i}] must be a non-empty string.`,
      );
    }
  }
  const unique = new Set(teamIds);
  if (unique.size !== teamIds.length) {
    throw new Error("Season schedule teamIds must be unique.");
  }
  if (!Number.isInteger(seasonLength) || seasonLength < 1) {
    throw new Error(
      "Season schedule seasonLength must be an integer >= 1.",
    );
  }
  const n = teamIds.length;
  if (n % 2 === 1 && seasonLength % (n - 1) !== 0) {
    throw new Error(
      `Season schedule for ${n} teams requires seasonLength to be a multiple of ${n - 1}.`,
    );
  }

  const sorted = [...teamIds].sort() as TeamId[];
  return { teamIds: sorted, seasonLength };
}
