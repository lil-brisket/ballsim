/**
 * Pure league hierarchy resolution from settings.
 * Maps teamCount / conferenceCount / divisionsEnabled to generation counts.
 */

export type LeagueShapeInput = {
  teamCount: number;
  conferenceCount: number;
  divisionsEnabled: boolean;
};

export type ResolvedLeagueShape = {
  conferenceCount: number;
  divisionsPerConference: number;
  teamsPerDivision: number;
  teamsPerConference: number;
};

export type ResolveLeagueShapeResult =
  | { ok: true; shape: ResolvedLeagueShape }
  | { ok: false; error: string };

/**
 * When divisions are disabled, uses one synthetic division per conference.
 * When enabled, requires at least 2 equal divisions per conference.
 */
export function tryResolveLeagueShape(
  input: LeagueShapeInput,
): ResolveLeagueShapeResult {
  const { teamCount, conferenceCount, divisionsEnabled } = input;

  if (!Number.isInteger(teamCount) || teamCount < 2) {
    return { ok: false, error: "teamCount must be an integer >= 2." };
  }
  if (!Number.isInteger(conferenceCount) || conferenceCount < 1) {
    return { ok: false, error: "conferenceCount must be an integer >= 1." };
  }
  if (teamCount % conferenceCount !== 0) {
    return {
      ok: false,
      error: `teamCount (${teamCount}) must be divisible by conferenceCount (${conferenceCount}).`,
    };
  }

  const teamsPerConference = teamCount / conferenceCount;

  if (!divisionsEnabled) {
    return {
      ok: true,
      shape: {
        conferenceCount,
        divisionsPerConference: 1,
        teamsPerDivision: teamsPerConference,
        teamsPerConference,
      },
    };
  }

  const divisionsPerConference = chooseDivisionsPerConference(teamsPerConference);
  if (divisionsPerConference === null) {
    return {
      ok: false,
      error: `Cannot enable divisions for ${teamsPerConference} teams per conference; need at least 2 equal divisions.`,
    };
  }

  const teamsPerDivision = teamsPerConference / divisionsPerConference;
  return {
    ok: true,
    shape: {
      conferenceCount,
      divisionsPerConference,
      teamsPerDivision,
      teamsPerConference,
    },
  };
}

export function resolveLeagueShape(input: LeagueShapeInput): ResolvedLeagueShape {
  const result = tryResolveLeagueShape(input);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.shape;
}

/**
 * Prefer classic 2 then 3 then 4 divisions, each with at least 2 teams.
 * Returns null when no such split exists (e.g. prime teamsPerConference).
 */
function chooseDivisionsPerConference(teamsPerConference: number): number | null {
  if (teamsPerConference < 4) {
    return null;
  }

  for (const d of [2, 3, 4]) {
    if (teamsPerConference % d === 0 && teamsPerConference / d >= 2) {
      return d;
    }
  }

  for (let d = 5; d <= Math.floor(teamsPerConference / 2); d += 1) {
    if (teamsPerConference % d === 0 && teamsPerConference / d >= 2) {
      return d;
    }
  }

  return null;
}
