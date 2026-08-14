import type { TeamId } from "@/domain/ids";
import {
  expectedRoundCount,
  type SeasonScheduleAssignment,
  type SeasonScheduleConfig,
  validateSeasonScheduleConfig,
} from "@/systems/schedule-generation-config";

function unorderedPairKey(a: TeamId, b: TeamId): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

/**
 * Validates a generated (or hand-built) season schedule against config invariants.
 * Does not mutate inputs. Throws Error on the first violation.
 * Streaks are not validated (soft preference only).
 */
export function validateSeasonSchedule(
  config: SeasonScheduleConfig,
  assignments: readonly SeasonScheduleAssignment[],
): void {
  const { teamIds, seasonLength } = validateSeasonScheduleConfig(config);
  const teamSet = new Set(teamIds);
  const roundCount = expectedRoundCount(teamIds.length, seasonLength);
  const expectedTotal = (teamIds.length * seasonLength) / 2;

  if (assignments.length !== expectedTotal) {
    throw new Error(
      `Season schedule must contain ${expectedTotal} games; got ${assignments.length}.`,
    );
  }

  const gamesPerTeam = new Map<TeamId, number>();
  const homeCount = new Map<TeamId, number>();
  const awayCount = new Map<TeamId, number>();
  for (const teamId of teamIds) {
    gamesPerTeam.set(teamId, 0);
    homeCount.set(teamId, 0);
    awayCount.set(teamId, 0);
  }

  const roundsSeen = new Set<number>();
  const teamsInRound = new Map<number, Set<TeamId>>();
  const matchupCounts = new Map<string, number>();

  for (let i = 0; i < assignments.length; i += 1) {
    const game = assignments[i]!;
    const { round, homeTeamId, awayTeamId } = game;

    if (!Number.isInteger(round)) {
      throw new Error(
        `Season schedule game[${i}] round must be an integer.`,
      );
    }
    if (round < 1 || round > roundCount) {
      throw new Error(
        `Season schedule game[${i}] round must be between 1 and ${roundCount}.`,
      );
    }
    roundsSeen.add(round);

    if (homeTeamId === awayTeamId) {
      throw new Error(
        `Season schedule game[${i}] must have two distinct teams.`,
      );
    }
    if (!teamSet.has(homeTeamId)) {
      throw new Error(
        `Season schedule game[${i}] homeTeamId is not in the config.`,
      );
    }
    if (!teamSet.has(awayTeamId)) {
      throw new Error(
        `Season schedule game[${i}] awayTeamId is not in the config.`,
      );
    }

    let inRound = teamsInRound.get(round);
    if (!inRound) {
      inRound = new Set();
      teamsInRound.set(round, inRound);
    }
    if (inRound.has(homeTeamId) || inRound.has(awayTeamId)) {
      throw new Error(
        `Season schedule round ${round} has a team playing more than once.`,
      );
    }
    inRound.add(homeTeamId);
    inRound.add(awayTeamId);

    gamesPerTeam.set(homeTeamId, gamesPerTeam.get(homeTeamId)! + 1);
    gamesPerTeam.set(awayTeamId, gamesPerTeam.get(awayTeamId)! + 1);
    homeCount.set(homeTeamId, homeCount.get(homeTeamId)! + 1);
    awayCount.set(awayTeamId, awayCount.get(awayTeamId)! + 1);

    const key = unorderedPairKey(homeTeamId, awayTeamId);
    matchupCounts.set(key, (matchupCounts.get(key) ?? 0) + 1);
  }

  for (let r = 1; r <= roundCount; r += 1) {
    if (!roundsSeen.has(r)) {
      throw new Error(
        `Season schedule is missing round ${r} (expected 1..${roundCount}).`,
      );
    }
  }

  for (const teamId of teamIds) {
    const games = gamesPerTeam.get(teamId)!;
    if (games !== seasonLength) {
      throw new Error(
        `Season schedule team ${teamId} has ${games} games; expected ${seasonLength}.`,
      );
    }
    const homes = homeCount.get(teamId)!;
    const aways = awayCount.get(teamId)!;
    if (Math.abs(homes - aways) > 1) {
      throw new Error(
        `Season schedule team ${teamId} home/away imbalance: ${homes} home, ${aways} away.`,
      );
    }
  }

  // Every unordered pair that appears at least once; for a connected RR
  // schedule every pair should appear (floor(G/(n-1)) or ceil).
  // Also pairs that never appear count as 0 when G < n-1 (partial RR).
  let minCount = Number.POSITIVE_INFINITY;
  let maxCount = 0;
  for (let i = 0; i < teamIds.length; i += 1) {
    for (let j = i + 1; j < teamIds.length; j += 1) {
      const count =
        matchupCounts.get(unorderedPairKey(teamIds[i]!, teamIds[j]!)) ?? 0;
      if (count < minCount) {
        minCount = count;
      }
      if (count > maxCount) {
        maxCount = count;
      }
    }
  }
  if (maxCount - minCount > 1) {
    throw new Error(
      `Season schedule matchup counts are uneven: min ${minCount}, max ${maxCount}.`,
    );
  }
}
