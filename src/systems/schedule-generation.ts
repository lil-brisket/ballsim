import { addCalendarDays } from "@/domain/calendar-date";
import { asGameId, type TeamId } from "@/domain/ids";
import { createGame, type Game } from "@/domain/entities/game";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  validateSeasonScheduleConfig,
  type SeasonScheduleAssignment,
  type SeasonScheduleConfig,
} from "@/systems/schedule-generation-config";
import { validateSeasonSchedule } from "@/systems/schedule-validation";
import { SEASON_LIFECYCLE_CONFIG } from "@/systems/simulation/season-lifecycle-config";

type UnorderedPair = {
  round: number;
  teamA: TeamId;
  teamB: TeamId;
};

/**
 * Pure season schedule generator (circle / Berger method + home/away phase).
 * Deterministic: same sorted teamIds and seasonLength → same assignments.
 * Does not use GameState, SystemResult, or Math.random().
 */
export function generateSeasonSchedule(
  config: SeasonScheduleConfig,
): SeasonScheduleAssignment[] {
  const { teamIds, seasonLength } = validateSeasonScheduleConfig(config);
  const unordered = buildUnorderedPairs(teamIds, seasonLength);
  const assignments = assignHomeAway(unordered, teamIds, seasonLength);
  validateSeasonSchedule({ teamIds, seasonLength }, assignments);
  return assignments;
}

/**
 * Builds a double round-robin regular-season schedule into GameState.
 * Idempotent: no-op when schedule.gameIds is already non-empty.
 * Does not mutate season.phase — callers use transitionPhase("regular").
 * Uses {@link generateSeasonSchedule} with defaultSeasonLength; each round
 * maps to one calendar day. Round 1 lands on currentDate + scheduleStartOffsetDays.
 */
export function generateSchedule(state: GameState): SystemResult {
  if (state.competition.schedule.gameIds.length > 0) {
    return systemResult(state);
  }

  const teamIds = Object.keys(state.world.teams).sort() as TeamId[];
  if (teamIds.length < 2) {
    throw new Error(
      "Schedule generation requires at least 2 teams in world.teams.",
    );
  }

  const seasonLength = state.settings.regularSeason.gamesPerTeam;
  const assignments = generateSeasonSchedule({ teamIds, seasonLength });

  const games: Record<string, Game> = {};
  const gameIds: Game["id"][] = [];
  const seasonId = state.competition.season.id;
  const currentDate = state.world.calendar.currentDate;
  const startOffset = SEASON_LIFECYCLE_CONFIG.scheduleStartOffsetDays;

  for (let index = 0; index < assignments.length; index += 1) {
    const assignment = assignments[index]!;
    const gameId = asGameId(`game_${seasonId}_${index}`);
    // Rounds are 1-based; offset 0 places round 1 on currentDate.
    const date = addCalendarDays(
      currentDate,
      assignment.round - 1 + startOffset,
    );
    games[gameId] = createGame({
      id: gameId,
      seasonId,
      date,
      homeTeamId: assignment.homeTeamId,
      awayTeamId: assignment.awayTeamId,
      competitionType: "regular_season",
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });
    gameIds.push(gameId);
  }

  return systemResult({
    ...state,
    competition: {
      ...state.competition,
      schedule: {
        seasonId,
        gameIds,
      },
      games,
    },
  });
}

function buildUnorderedPairs(
  teamIds: TeamId[],
  seasonLength: number,
): UnorderedPair[] {
  const n = teamIds.length;
  const cycle = generateCircleCycle(teamIds);
  const pairs: UnorderedPair[] = [];

  if (n % 2 === 0) {
    // seasonLength rounds = complete cycles + prefix of next cycle
    for (let round = 1; round <= seasonLength; round += 1) {
      const cycleRound = cycle[(round - 1) % cycle.length]!;
      for (const [a, b] of cycleRound) {
        const teamA = a < b ? a : b;
        const teamB = a < b ? b : a;
        pairs.push({ round, teamA, teamB });
      }
    }
  } else {
    // Complete cycles only; seasonLength is a multiple of n-1
    const cycleCount = seasonLength / (n - 1);
    let round = 1;
    for (let c = 0; c < cycleCount; c += 1) {
      for (const cycleRound of cycle) {
        for (const [a, b] of cycleRound) {
          const teamA = a < b ? a : b;
          const teamB = a < b ? b : a;
          pairs.push({ round, teamA, teamB });
        }
        round += 1;
      }
    }
  }

  // Deterministic order within each round
  pairs.sort((left, right) => {
    if (left.round !== right.round) {
      return left.round - right.round;
    }
    if (left.teamA !== right.teamA) {
      return left.teamA < right.teamA ? -1 : 1;
    }
    return left.teamB < right.teamB ? -1 : 1;
  });

  return pairs;
}

/**
 * One complete single round-robin as unordered pair lists per round (0-based cycle index).
 * Even n: n-1 rounds. Odd n: n rounds with one bye each.
 */
function generateCircleCycle(
  teamIds: TeamId[],
): Array<Array<[TeamId, TeamId]>> {
  const n = teamIds.length;
  const hasBye = n % 2 === 1;
  const slots: Array<TeamId | null> = hasBye
    ? [...teamIds, null]
    : [...teamIds];
  const slotCount = slots.length;
  const roundsInCycle = slotCount - 1;
  const fixed = slots[0]!;
  let rotating = slots.slice(1);
  const rounds: Array<Array<[TeamId, TeamId]>> = [];

  for (let r = 0; r < roundsInCycle; r += 1) {
    const circle: Array<TeamId | null> = [fixed, ...rotating];
    const pairs: Array<[TeamId, TeamId]> = [];
    for (let i = 0; i < slotCount / 2; i += 1) {
      const a = circle[i]!;
      const b = circle[slotCount - 1 - i]!;
      if (a !== null && b !== null) {
        pairs.push([a, b]);
      }
    }
    rounds.push(pairs);
    const last = rotating[rotating.length - 1]!;
    rotating = [last, ...rotating.slice(0, -1)];
  }

  return rounds;
}

function unorderedPairKey(a: TeamId, b: TeamId): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

/**
 * Assigns home/away after matchups are fixed.
 * Hard: |home - away| <= 1; alternate venues on repeats when possible.
 * Soft: prefer breaking home/away streaks (never reject for streak alone).
 */
function assignHomeAway(
  pairs: UnorderedPair[],
  teamIds: TeamId[],
  seasonLength: number,
): SeasonScheduleAssignment[] {
  const maxSide = Math.ceil(seasonLength / 2);
  const homeCount = new Map<TeamId, number>();
  const awayCount = new Map<TeamId, number>();
  const lastVenue = new Map<TeamId, "home" | "away" | null>();
  const matchupHomes = new Map<string, TeamId[]>();

  for (const teamId of teamIds) {
    homeCount.set(teamId, 0);
    awayCount.set(teamId, 0);
    lastVenue.set(teamId, null);
  }

  const assignments: SeasonScheduleAssignment[] = [];

  for (const pair of pairs) {
    const { round, teamA, teamB } = pair;
    const key = unorderedPairKey(teamA, teamB);
    const history = matchupHomes.get(key) ?? [];

    const optionAHome = scoreHomeOption(
      teamA,
      teamB,
      homeCount,
      awayCount,
      lastVenue,
      history,
      maxSide,
    );
    const optionBHome = scoreHomeOption(
      teamB,
      teamA,
      homeCount,
      awayCount,
      lastVenue,
      history,
      maxSide,
    );

    let homeTeamId: TeamId;
    let awayTeamId: TeamId;

    if (optionAHome.feasible && !optionBHome.feasible) {
      homeTeamId = teamA;
      awayTeamId = teamB;
    } else if (optionBHome.feasible && !optionAHome.feasible) {
      homeTeamId = teamB;
      awayTeamId = teamA;
    } else if (optionAHome.feasible && optionBHome.feasible) {
      if (optionAHome.score !== optionBHome.score) {
        if (optionAHome.score > optionBHome.score) {
          homeTeamId = teamA;
          awayTeamId = teamB;
        } else {
          homeTeamId = teamB;
          awayTeamId = teamA;
        }
      } else {
        // Deterministic tie-break: lexicographically smaller team at home
        if (teamA < teamB) {
          homeTeamId = teamA;
          awayTeamId = teamB;
        } else {
          homeTeamId = teamB;
          awayTeamId = teamA;
        }
      }
    } else {
      // Both exceed soft caps mid-schedule; pick the less imbalanced option
      if (optionAHome.score >= optionBHome.score) {
        homeTeamId = teamA;
        awayTeamId = teamB;
      } else {
        homeTeamId = teamB;
        awayTeamId = teamA;
      }
    }

    assignments.push({ round, homeTeamId, awayTeamId });
    homeCount.set(homeTeamId, homeCount.get(homeTeamId)! + 1);
    awayCount.set(awayTeamId, awayCount.get(awayTeamId)! + 1);
    lastVenue.set(homeTeamId, "home");
    lastVenue.set(awayTeamId, "away");
    history.push(homeTeamId);
    matchupHomes.set(key, history);
  }

  // Repair home/away imbalance via pairwise swaps when needed
  repairHomeAwayBalance(assignments, teamIds, seasonLength);

  return assignments;
}

function scoreHomeOption(
  homeCandidate: TeamId,
  awayCandidate: TeamId,
  homeCount: Map<TeamId, number>,
  awayCount: Map<TeamId, number>,
  lastVenue: Map<TeamId, "home" | "away" | null>,
  matchupHomeHistory: readonly TeamId[],
  maxSide: number,
): { feasible: boolean; score: number } {
  const homeAfter = homeCount.get(homeCandidate)! + 1;
  const awayAfter = awayCount.get(awayCandidate)! + 1;
  const feasible = homeAfter <= maxSide && awayAfter <= maxSide;

  let score = 0;

  // Prefer the team that currently has fewer homes (balance)
  score +=
    (awayCount.get(homeCandidate)! - homeCount.get(homeCandidate)!) -
    (awayCount.get(awayCandidate)! - homeCount.get(awayCandidate)!);

  // Prefer alternating venue for this matchup
  if (matchupHomeHistory.length > 0) {
    const lastHome = matchupHomeHistory[matchupHomeHistory.length - 1]!;
    if (lastHome !== homeCandidate) {
      score += 10;
    } else {
      score -= 10;
    }
  }

  // Soft: break streaks
  if (lastVenue.get(homeCandidate) === "home") {
    score -= 1;
  }
  if (lastVenue.get(awayCandidate) === "away") {
    score -= 1;
  }
  if (lastVenue.get(homeCandidate) === "away") {
    score += 1;
  }
  if (lastVenue.get(awayCandidate) === "home") {
    score += 1;
  }

  return { feasible, score };
}

/**
 * If any team is outside |home-away|<=1, swap home/away on games where both
 * teams improve (or one improves without harming the other past balance).
 */
function repairHomeAwayBalance(
  assignments: SeasonScheduleAssignment[],
  teamIds: TeamId[],
  seasonLength: number,
): void {
  const targetMin = Math.floor(seasonLength / 2);
  const targetMax = Math.ceil(seasonLength / 2);

  for (let pass = 0; pass < assignments.length * 2; pass += 1) {
    const homeCount = new Map<TeamId, number>();
    for (const teamId of teamIds) {
      homeCount.set(teamId, 0);
    }
    for (const game of assignments) {
      homeCount.set(game.homeTeamId, homeCount.get(game.homeTeamId)! + 1);
    }

    let imbalanced: TeamId | null = null;
    for (const teamId of teamIds) {
      const homes = homeCount.get(teamId)!;
      if (homes < targetMin || homes > targetMax) {
        imbalanced = teamId;
        break;
      }
    }
    if (imbalanced === null) {
      return;
    }

    const homes = homeCount.get(imbalanced)!;
    const needsMoreHome = homes < targetMin;

    let swapped = false;
    for (let i = 0; i < assignments.length; i += 1) {
      const game = assignments[i]!;
      if (needsMoreHome) {
        if (game.awayTeamId !== imbalanced) {
          continue;
        }
        const other = game.homeTeamId;
        const otherHomes = homeCount.get(other)!;
        // Swap: imbalanced becomes home, other becomes away
        if (otherHomes > targetMin) {
          assignments[i] = {
            round: game.round,
            homeTeamId: imbalanced,
            awayTeamId: other,
          };
          swapped = true;
          break;
        }
      } else {
        if (game.homeTeamId !== imbalanced) {
          continue;
        }
        const other = game.awayTeamId;
        const otherHomes = homeCount.get(other)!;
        // Swap: imbalanced becomes away, other becomes home
        if (otherHomes < targetMax) {
          assignments[i] = {
            round: game.round,
            homeTeamId: other,
            awayTeamId: imbalanced,
          };
          swapped = true;
          break;
        }
      }
    }

    if (!swapped) {
      // Fallback: any swap that moves imbalance toward balance
      for (let i = 0; i < assignments.length; i += 1) {
        const game = assignments[i]!;
        if (needsMoreHome && game.awayTeamId === imbalanced) {
          assignments[i] = {
            round: game.round,
            homeTeamId: imbalanced,
            awayTeamId: game.homeTeamId,
          };
          swapped = true;
          break;
        }
        if (!needsMoreHome && game.homeTeamId === imbalanced) {
          assignments[i] = {
            round: game.round,
            homeTeamId: game.awayTeamId,
            awayTeamId: imbalanced,
          };
          swapped = true;
          break;
        }
      }
    }

    if (!swapped) {
      return;
    }
  }
}
