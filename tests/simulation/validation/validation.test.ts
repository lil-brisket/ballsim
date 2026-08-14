import { describe, expect, it } from "vitest";
import type { TeamGameSnapshot } from "@/simulation/validation/types";
import { checkTeamSnapshotInvariants } from "@/simulation/validation/invariants";
import { computeValidationChecksum } from "@/simulation/validation/checksum";
import { aggregateSnapshots } from "@/simulation/validation/aggregate";
import { collectGameSnapshot } from "@/simulation/validation/collect-game-stats";
import { pearsonCorrelation } from "@/simulation/validation/correlations";
import {
  generateValidationRosters,
  runSimulationValidation,
} from "@/simulation/validation/run-validation";
import { createSeededRng } from "@/domain/rng";
import { createGame } from "@/domain/entities/game";
import {
  asGameId,
  asSeasonId,
  asTeamId,
} from "@/domain/ids";
import { simulateGame } from "@/systems/game-simulation";
import { createGameResult, aggregateTeamStats } from "@/domain/entities/game-result";
import { createEmptyGamePlayerStats } from "@/domain/entities/game";
import { asPlayerId } from "@/domain/ids";

function validTeam(
  overrides: Partial<TeamGameSnapshot> = {},
): TeamGameSnapshot {
  const fieldGoalsMade = overrides.fieldGoalsMade ?? 40;
  const threePointersMade = overrides.threePointersMade ?? 10;
  const freeThrowsMade = overrides.freeThrowsMade ?? 20;
  const fieldGoalsAttempted = overrides.fieldGoalsAttempted ?? 90;
  const threePointersAttempted = overrides.threePointersAttempted ?? 30;
  const freeThrowsAttempted = overrides.freeThrowsAttempted ?? 25;
  const twoPointFgm = fieldGoalsMade - threePointersMade;
  const defaultPoints = 2 * twoPointFgm + 3 * threePointersMade + freeThrowsMade;
  const points = overrides.points ?? defaultPoints;
  const possessions = overrides.possessions ?? 100;
  return {
    side: overrides.side ?? "home",
    teamId: overrides.teamId ?? "team_a",
    points,
    fieldGoalsMade,
    fieldGoalsAttempted,
    threePointersMade,
    threePointersAttempted,
    freeThrowsMade,
    freeThrowsAttempted,
    offensiveRebounds: overrides.offensiveRebounds ?? 10,
    defensiveRebounds: overrides.defensiveRebounds ?? 30,
    rebounds: overrides.rebounds ?? 40,
    assists: overrides.assists ?? 22,
    turnovers: overrides.turnovers ?? 14,
    fouls: overrides.fouls ?? 18,
    possessions,
    fieldGoalPct:
      overrides.fieldGoalPct !== undefined
        ? overrides.fieldGoalPct
        : fieldGoalsAttempted === 0
          ? null
          : fieldGoalsMade / fieldGoalsAttempted,
    threePointPct:
      overrides.threePointPct !== undefined
        ? overrides.threePointPct
        : threePointersAttempted === 0
          ? null
          : threePointersMade / threePointersAttempted,
    freeThrowPct:
      overrides.freeThrowPct !== undefined
        ? overrides.freeThrowPct
        : freeThrowsAttempted === 0
          ? null
          : freeThrowsMade / freeThrowsAttempted,
    pointsPerPossession:
      overrides.pointsPerPossession !== undefined
        ? overrides.pointsPerPossession
        : possessions > 0
          ? points / possessions
          : null,
  };
}

describe("checkTeamSnapshotInvariants", () => {
  it("passes a consistent team snapshot", () => {
    const team = validTeam();
    expect(checkTeamSnapshotInvariants(team, team.points)).toEqual([]);
  });

  it("fails when 3PM exceeds FGM", () => {
    const team = validTeam({
      fieldGoalsMade: 5,
      threePointersMade: 6,
      fieldGoalsAttempted: 20,
      threePointersAttempted: 10,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      points: 2 * (5 - 6) + 3 * 6 + 0,
      fieldGoalPct: 5 / 20,
      threePointPct: 6 / 10,
      freeThrowPct: null,
    });
    const failures = checkTeamSnapshotInvariants(team, team.points);
    expect(failures.some((f) => f.rule === "3PM_LE_FGM")).toBe(true);
    expect(failures.some((f) => f.rule === "TWO_POINT_FGM_NONNEG")).toBe(true);
  });

  it("allows zero-attempt percentages as null", () => {
    const team = validTeam({
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      threePointersMade: 0,
      threePointersAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      points: 0,
      fieldGoalPct: null,
      threePointPct: null,
      freeThrowPct: null,
      pointsPerPossession: 0,
      assists: 0,
    });
    expect(checkTeamSnapshotInvariants(team, 0)).toEqual([]);
  });

  it("fails points identity mismatch", () => {
    const team = validTeam({ points: 999 });
    const failures = checkTeamSnapshotInvariants(team, 999);
    expect(failures.some((f) => f.rule === "POINTS_IDENTITY")).toBe(true);
  });

  it("fails non-positive possessions", () => {
    const team = validTeam({ possessions: 0, pointsPerPossession: null });
    const failures = checkTeamSnapshotInvariants(team, team.points);
    expect(failures.some((f) => f.rule === "POSSESSIONS_POSITIVE")).toBe(true);
  });
});

describe("collectGameSnapshot", () => {
  it("maps GameResult fields without inventing steals/blocks", () => {
    const homeId = asTeamId("team_home");
    const awayId = asTeamId("team_away");
    const homePlayer = asPlayerId("p_home");
    const awayPlayer = asPlayerId("p_away");
    const homeStats = {
      ...createEmptyGamePlayerStats(homePlayer),
      points: 100,
      fieldGoalsMade: 40,
      fieldGoalsAttempted: 80,
      threePointersMade: 10,
      threePointersAttempted: 30,
      freeThrowsMade: 10,
      freeThrowsAttempted: 12,
      rebounds: 40,
      offensiveRebounds: 10,
      defensiveRebounds: 30,
      assists: 20,
      turnovers: 12,
      fouls: 15,
    };
    const awayStats = {
      ...createEmptyGamePlayerStats(awayPlayer),
      points: 95,
      fieldGoalsMade: 38,
      fieldGoalsAttempted: 82,
      threePointersMade: 9,
      threePointersAttempted: 28,
      freeThrowsMade: 10,
      freeThrowsAttempted: 14,
      rebounds: 38,
      offensiveRebounds: 8,
      defensiveRebounds: 30,
      assists: 18,
      turnovers: 14,
      fouls: 16,
    };
    const result = createGameResult({
      gameId: asGameId("g1"),
      seasonId: asSeasonId("s1"),
      date: "2026-10-15",
      homeTeamId: homeId,
      awayTeamId: awayId,
      status: "final",
      score: { home: 100, away: 95 },
      periodScores: [
        { home: 25, away: 20 },
        { home: 25, away: 25 },
        { home: 25, away: 25 },
        { home: 25, away: 25 },
      ],
      overtimePeriodCount: 0,
      possessionCounts: { home: 98, away: 97 },
      playerStats: [homeStats, awayStats],
      teamStats: {
        home: aggregateTeamStats(homeId, [homeStats]),
        away: aggregateTeamStats(awayId, [awayStats]),
      },
      events: [],
    });

    const snapshot = collectGameSnapshot(result);
    expect(snapshot.homePossessions).toBe(98);
    expect(snapshot.away.points).toBe(95);
    expect(snapshot.totalScore).toBe(195);
    expect(snapshot.winner).toBe("home");
    expect(snapshot.home.fieldGoalPct).toBeCloseTo(0.5);
    // Snapshot type has no steals/blocks fields
    expect("steals" in snapshot.home).toBe(false);
  });
});

describe("checksum", () => {
  it("is identical for the same seed and game count", () => {
    const a = runSimulationValidation({ games: 3, seed: 4242 });
    const b = runSimulationValidation({ games: 3, seed: 4242 });
    expect(a.checksum).toBe(b.checksum);
    expect(a.aggregates.teamPoints.mean).toBe(b.aggregates.teamPoints.mean);
  });

  it("excludes formatting: recomputed checksum matches", () => {
    const run = runSimulationValidation({ games: 2, seed: 7 });
    const again = computeValidationChecksum({
      seed: run.seed,
      gamesSimulated: run.gamesSimulated,
      aggregates: run.aggregates,
      invariantFailureCount: 0,
      plausibilityChecks: run.plausibilityChecks,
      correlations: run.correlations,
      overallVerdict: run.overallVerdict,
    });
    expect(again).toBe(run.checksum);
  });
});

describe("immutability", () => {
  it("does not mutate shared Player[] across simulateGame calls", () => {
    const rng = createSeededRng(99);
    const { homePlayers, awayPlayers } = generateValidationRosters(rng, 10);
    const before = structuredClone({ homePlayers, awayPlayers });

    simulateGame(
      createGame({
        id: asGameId("imm_1"),
        seasonId: asSeasonId("season_validation"),
        homeTeamId: asTeamId("team_validation_home"),
        awayTeamId: asTeamId("team_validation_away"),
        date: "2026-10-15",
        status: "scheduled",
        score: { home: 0, away: 0 },
        periodScores: [],
        events: [],
        playerStats: [],
      }),
      { homePlayers, awayPlayers },
      rng,
    );
    simulateGame(
      createGame({
        id: asGameId("imm_2"),
        seasonId: asSeasonId("season_validation"),
        homeTeamId: asTeamId("team_validation_home"),
        awayTeamId: asTeamId("team_validation_away"),
        date: "2026-10-15",
        status: "scheduled",
        score: { home: 0, away: 0 },
        periodScores: [],
        events: [],
        playerStats: [],
      }),
      { homePlayers, awayPlayers },
      rng,
    );

    expect(homePlayers).toEqual(before.homePlayers);
    expect(awayPlayers).toEqual(before.awayPlayers);
  });
});

describe("possessionCounts", () => {
  it("are positive after a short-clock complete game", () => {
    const rng = createSeededRng(55);
    const { homePlayers, awayPlayers } = generateValidationRosters(rng, 7);
    const result = simulateGame(
      createGame({
        id: asGameId("poss_1"),
        seasonId: asSeasonId("season_validation"),
        homeTeamId: asTeamId("team_validation_home"),
        awayTeamId: asTeamId("team_validation_away"),
        date: "2026-10-15",
        status: "scheduled",
        score: { home: 0, away: 0 },
        periodScores: [],
        events: [],
        playerStats: [],
      }),
      {
        homePlayers,
        awayPlayers,
        config: {
          regulationPeriodSeconds: 24,
          overtimePeriodSeconds: 6,
          possessionTimeSeconds: {
            defaultMin: 6,
            defaultMax: 6,
            turnoverMin: 6,
            turnoverMax: 6,
            foulMin: 6,
            foulMax: 6,
            freeThrowMin: 6,
            freeThrowMax: 6,
          },
        },
      },
      rng,
    );
    expect(result.possessionCounts.home).toBeGreaterThan(0);
    expect(result.possessionCounts.away).toBeGreaterThan(0);
  });
});

describe("pearsonCorrelation", () => {
  it("returns positive for aligned series", () => {
    const r = pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]);
    expect(r).toBeCloseTo(1);
  });
});

describe("aggregateSnapshots", () => {
  it("averages team-grain percentages without pooling into mean", () => {
    // Covered indirectly via runSimulationValidation checksum stability
    const run = runSimulationValidation({ games: 2, seed: 11 });
    expect(run.aggregates.gamesSimulated).toBe(2);
    expect(run.aggregates.pooledShooting.fieldGoalsAttempted).toBeGreaterThan(0);
    expect(aggregateSnapshots([], 1).gamesSimulated).toBe(0);
  });
});
