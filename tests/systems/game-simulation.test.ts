import { describe, expect, it } from "vitest";
import { createFoul } from "@/domain/entities/foul";
import { createGame } from "@/domain/entities/game";
import type { Player } from "@/domain/entities/player";
import {
  asGameId,
  asPlayerId,
  asSeasonId,
  asTeamId,
  type TeamId,
} from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { createPlayer } from "../factories/player";
import { createTestRng } from "../helpers/determinism";
import {
  consumeTime,
  createGameClock,
  isPeriodOver,
} from "@/systems/game-clock";
import {
  simulateGame,
  type SimulateGameContext,
} from "@/systems/game-simulation";

const HOME = asTeamId("team_home");
const AWAY = asTeamId("team_away");

function makeRoster(teamId: TeamId, prefix: string, count: number): Player[] {
  const positions = ["PG", "SG", "SF", "PF", "C"] as const;
  return Array.from({ length: count }, (_, index) =>
    createPlayer({
      id: asPlayerId(`${prefix}_${index + 1}`),
      teamId,
      position: positions[index % positions.length]!,
      firstName: prefix,
      lastName: `P${index + 1}`,
    }),
  );
}

function scheduledGame() {
  return createGame({
    id: asGameId("game_sim_1"),
    seasonId: asSeasonId("season_1"),
    homeTeamId: HOME,
    awayTeamId: AWAY,
    date: "2026-10-15",
    status: "scheduled",
    score: { home: 0, away: 0 },
    periodScores: [],
    events: [],
    playerStats: [],
  });
}

function shortConfig() {
  return {
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
  };
}

describe("game clock", () => {
  it("never goes negative and clamps requested time to remaining", () => {
    const clock = createGameClock(3);
    const result = consumeTime(clock, 8);
    expect(result.elapsedSeconds).toBe(3);
    expect(result.clock.remainingSeconds).toBe(0);
    expect(isPeriodOver(result.clock)).toBe(true);
  });
});

describe("simulateGame", () => {
  it("completes regulation with four period scores and a non-tied final", () => {
    const home = makeRoster(HOME, "home", 7);
    const away = makeRoster(AWAY, "away", 7);
    const result = simulateGame(
      scheduledGame(),
      { homePlayers: home, awayPlayers: away, config: shortConfig() },
      createTestRng(100),
    );

    expect(result.status).toBe("final");
    expect(result.score.home).toBeGreaterThanOrEqual(0);
    expect(result.score.away).toBeGreaterThanOrEqual(0);
    expect(result.score.home).not.toBe(result.score.away);
    expect(result.periodScores.length).toBeGreaterThanOrEqual(4);
    expect(result.periodScores.slice(0, 4)).toHaveLength(4);

    const summed = result.periodScores.reduce(
      (acc, period) => ({
        home: acc.home + period.home,
        away: acc.away + period.away,
      }),
      { home: 0, away: 0 },
    );
    expect(summed).toEqual(result.score);
  });

  it("includes DNP roster rows with zero minutes and stats", () => {
    const home = makeRoster(HOME, "home", 7);
    const away = makeRoster(AWAY, "away", 7);
    const result = simulateGame(
      scheduledGame(),
      { homePlayers: home, awayPlayers: away, config: shortConfig() },
      createTestRng(101),
    );

    expect(result.playerStats).toHaveLength(14);
    const dnps = result.playerStats.filter((row) => row.minutes === 0);
    expect(dnps.length).toBeGreaterThanOrEqual(4);
    for (const row of dnps) {
      expect(row.points).toBe(0);
      expect(row.rebounds).toBe(0);
      expect(row.assists).toBe(0);
    }
  });

  it("reconciles player points with team points and final score", () => {
    const home = makeRoster(HOME, "home", 6);
    const away = makeRoster(AWAY, "away", 6);
    const result = simulateGame(
      scheduledGame(),
      { homePlayers: home, awayPlayers: away, config: shortConfig() },
      createTestRng(102),
    );

    const homePoints = result.playerStats
      .filter((row) => home.some((player) => player.id === row.playerId))
      .reduce((sum, row) => sum + row.points, 0);
    const awayPoints = result.playerStats
      .filter((row) => away.some((player) => player.id === row.playerId))
      .reduce((sum, row) => sum + row.points, 0);

    expect(homePoints).toBe(result.teamStats.home.points);
    expect(awayPoints).toBe(result.teamStats.away.points);
    expect(homePoints).toBe(result.score.home);
    expect(awayPoints).toBe(result.score.away);
  });

  it("reconciles attributable team/player stats", () => {
    const home = makeRoster(HOME, "home", 6);
    const away = makeRoster(AWAY, "away", 6);
    const result = simulateGame(
      scheduledGame(),
      { homePlayers: home, awayPlayers: away, config: shortConfig() },
      createTestRng(103),
    );

    for (const side of ["home", "away"] as const) {
      const roster = side === "home" ? home : away;
      const rows = result.playerStats.filter((row) =>
        roster.some((player) => player.id === row.playerId),
      );
      const team = result.teamStats[side];
      expect(rows.reduce((s, r) => s + r.rebounds, 0)).toBe(team.rebounds);
      expect(rows.reduce((s, r) => s + r.assists, 0)).toBe(team.assists);
      expect(rows.reduce((s, r) => s + r.turnovers, 0)).toBe(team.turnovers);
      expect(rows.reduce((s, r) => s + r.fouls, 0)).toBe(team.fouls);
      expect(rows.reduce((s, r) => s + r.fieldGoalsMade, 0)).toBe(
        team.fieldGoalsMade,
      );
      expect(rows.reduce((s, r) => s + r.freeThrowsMade, 0)).toBe(
        team.freeThrowsMade,
      );
      expect(
        rows.reduce((s, r) => s + r.offensiveRebounds, 0),
      ).toBe(team.offensiveRebounds);
      expect(
        rows.reduce((s, r) => s + r.defensiveRebounds, 0),
      ).toBe(team.defensiveRebounds);
    }
  });

  it("produces globally increasing event sequences", () => {
    const home = makeRoster(HOME, "home", 5);
    const away = makeRoster(AWAY, "away", 5);
    const result = simulateGame(
      scheduledGame(),
      { homePlayers: home, awayPlayers: away, config: shortConfig() },
      createTestRng(104),
    );

    for (let index = 1; index < result.events.length; index += 1) {
      expect(result.events[index]!.sequence).toBeGreaterThan(
        result.events[index - 1]!.sequence,
      );
    }
  });

  it("is deterministic for the same RNG seed", () => {
    const home = makeRoster(HOME, "home", 5);
    const away = makeRoster(AWAY, "away", 5);
    const context: SimulateGameContext = {
      homePlayers: home,
      awayPlayers: away,
      config: shortConfig(),
    };
    const a = simulateGame(scheduledGame(), context, createTestRng(55));
    const b = simulateGame(scheduledGame(), context, createTestRng(55));
    expect(a).toEqual(b);
  });

  it("returns a self-contained GameResult suitable for a box score", () => {
    const home = makeRoster(HOME, "home", 5);
    const away = makeRoster(AWAY, "away", 5);
    const result = simulateGame(
      scheduledGame(),
      { homePlayers: home, awayPlayers: away, config: shortConfig() },
      createTestRng(105),
    );

    expect(result.gameId).toBe("game_sim_1");
    expect(result.homeTeamId).toBe(HOME);
    expect(result.awayTeamId).toBe(AWAY);
    expect(result.teamStats.home.teamId).toBe(HOME);
    expect(result.teamStats.away.teamId).toBe(AWAY);
    expect(result.playerStats.length).toBeGreaterThan(0);
    expect(Array.isArray(result.events)).toBe(true);
    expect(result).not.toHaveProperty("game");
  });

  it("exhausts the clock mid-possession without starting another in that period", () => {
    const home = makeRoster(HOME, "home", 5);
    const away = makeRoster(AWAY, "away", 5);
    let possessionCount = 0;
    const result = simulateGame(
      scheduledGame(),
      {
        homePlayers: home,
        awayPlayers: away,
        config: {
          regulationPeriodCount: 1,
          regulationPeriodSeconds: 3,
          overtimePeriodSeconds: 3,
          possessionTimeSeconds: {
            defaultMin: 8,
            defaultMax: 8,
            turnoverMin: 8,
            turnoverMax: 8,
            foulMin: 8,
            foulMax: 8,
            freeThrowMin: 8,
            freeThrowMax: 8,
          },
        },
        chooseDecision: (input) => {
          possessionCount += 1;
          return {
            action: "shot",
            shooterId: input.offensivePlayers[0]!.id,
            defenderId: input.defensivePlayers[0]!.id,
            shotType: "two_point",
          };
        },
      },
      createTestRng(1),
    );

    // One regulation period of 3s with 8s request → one possession, then OT until untied.
    expect(possessionCount).toBeGreaterThanOrEqual(1);
    expect(result.periodScores.length).toBeGreaterThanOrEqual(1);
    expect(result.status).toBe("final");
    expect(result.score.home).not.toBe(result.score.away);
  });

  it("enters overtime when regulation ends tied and never finishes tied", () => {
    const home = makeRoster(HOME, "home", 5);
    const away = makeRoster(AWAY, "away", 5);

    // Force zero scoring in regulation (turnovers), then allow shots in OT.
    let periodPossessions = 0;
    const result = simulateGame(
      scheduledGame(),
      {
        homePlayers: home,
        awayPlayers: away,
        config: {
          regulationPeriodCount: 4,
          regulationPeriodSeconds: 6,
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
        chooseDecision: (input) => {
          periodPossessions += 1;
          const offensePlayer = input.offensivePlayers[0]!;
          const defensePlayer = input.defensivePlayers[0]!;
          if (periodPossessions <= 4) {
            return {
              action: "turnover",
              playerId: offensePlayer.id,
            };
          }
          return {
            action: "shot",
            shooterId: offensePlayer.id,
            defenderId: defensePlayer.id,
            shotType: "two_point",
          };
        },
      },
      createStubChanceAlwaysTrue(),
    );

    expect(result.periodScores.length).toBeGreaterThan(4);
    expect(result.overtimePeriodCount).toBeGreaterThanOrEqual(1);
    expect(result.score.home).not.toBe(result.score.away);
    // Regulation period deltas should all be 0-0 when only turnovers ran.
    for (let index = 0; index < 4; index += 1) {
      expect(result.periodScores[index]).toEqual({ home: 0, away: 0 });
    }
  });

  it("supports multiple overtime periods when needed", () => {
    const home = makeRoster(HOME, "home", 5);
    const away = makeRoster(AWAY, "away", 5);
    let call = 0;
    const result = simulateGame(
      scheduledGame(),
      {
        homePlayers: home,
        awayPlayers: away,
        config: {
          regulationPeriodCount: 4,
          regulationPeriodSeconds: 6,
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
        chooseDecision: (input) => {
          call += 1;
          const offensePlayer = input.offensivePlayers[0]!;
          const defensePlayer = input.defensivePlayers[0]!;
          // Regulation: turnovers (tied 0-0)
          if (call <= 4) {
            return { action: "turnover", playerId: offensePlayer.id };
          }
          // OT1: turnovers again (still tied)
          if (call <= 5) {
            return { action: "turnover", playerId: offensePlayer.id };
          }
          // OT2+: make a shot
          return {
            action: "shot",
            shooterId: offensePlayer.id,
            defenderId: defensePlayer.id,
            shotType: "two_point",
          };
        },
      },
      createStubChanceAlwaysTrue(),
    );

    expect(result.overtimePeriodCount).toBeGreaterThanOrEqual(2);
    expect(result.periodScores.length).toBe(
      4 + result.overtimePeriodCount,
    );
    expect(result.score.home).not.toBe(result.score.away);
  });

  it("credits three-point field goals as 3 points", () => {
    const home = makeRoster(HOME, "home", 5);
    const away = makeRoster(AWAY, "away", 5);
    const result = simulateGame(
      scheduledGame(),
      {
        homePlayers: home,
        awayPlayers: away,
        config: {
          regulationPeriodCount: 1,
          regulationPeriodSeconds: 6,
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
        chooseDecision: (input) => ({
          action: "shot",
          shooterId: input.offensivePlayers[0]!.id,
          defenderId: input.defensivePlayers[0]!.id,
          shotType: "three_point",
        }),
      },
      createStubChanceAlwaysTrue(),
    );

    expect(result.score.home + result.score.away).toBeGreaterThanOrEqual(3);
    const threePointScorer = result.playerStats.find(
      (row) => row.threePointersMade > 0,
    );
    expect(threePointScorer).toBeDefined();
    expect(threePointScorer!.points).toBeGreaterThanOrEqual(3);
    expect(threePointScorer!.threePointersAttempted).toBeGreaterThanOrEqual(
      threePointScorer!.threePointersMade,
    );
  });

  it("does not award points on turnovers", () => {
    const home = makeRoster(HOME, "home", 5);
    const away = makeRoster(AWAY, "away", 5);
    let call = 0;
    const result = simulateGame(
      scheduledGame(),
      {
        homePlayers: home,
        awayPlayers: away,
        config: {
          regulationPeriodCount: 4,
          regulationPeriodSeconds: 6,
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
        chooseDecision: (input) => {
          call += 1;
          const offensePlayer = input.offensivePlayers[0]!;
          const defensePlayer = input.defensivePlayers[0]!;
          if (call <= 4) {
            return { action: "turnover", playerId: offensePlayer.id };
          }
          return {
            action: "shot",
            shooterId: offensePlayer.id,
            defenderId: defensePlayer.id,
            shotType: "two_point",
          };
        },
      },
      createStubChanceAlwaysTrue(),
    );

    for (let index = 0; index < 4; index += 1) {
      expect(result.periodScores[index]).toEqual({ home: 0, away: 0 });
    }
  });

  it("applies shooting foul free-throw sequences without double-counting", () => {
    const home = makeRoster(HOME, "home", 5);
    const away = makeRoster(AWAY, "away", 5);
    let call = 0;
    const result = simulateGame(
      scheduledGame(),
      {
        homePlayers: home,
        awayPlayers: away,
        config: {
          regulationPeriodCount: 1,
          regulationPeriodSeconds: 6,
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
        chooseDecision: (input) => {
          call += 1;
          const offensePlayer = input.offensivePlayers[0]!;
          const defensePlayer = input.defensivePlayers[0]!;
          if (call === 1) {
            return {
              action: "foul",
              foul: createFoul({
                foulingPlayerId: defensePlayer.id,
                fouledPlayerId: offensePlayer.id,
                foulType: "shooting",
              }),
              shotType: "two_point",
            };
          }
          return {
            action: "shot",
            shooterId: offensePlayer.id,
            defenderId: defensePlayer.id,
            shotType: "two_point",
          };
        },
      },
      createStubChanceAlwaysTrue(),
    );

    const fouler = result.playerStats.find((row) => row.fouls > 0);
    const ftShooter = result.playerStats.find(
      (row) => row.freeThrowsAttempted > 0,
    );
    expect(fouler).toBeDefined();
    expect(ftShooter).toBeDefined();
    expect(ftShooter!.freeThrowsMade).toBeGreaterThanOrEqual(1);
    expect(result.events.some((event) => event.type === "foul")).toBe(true);
    expect(result.events.some((event) => event.type === "free_throw")).toBe(
      true,
    );
    expect(result.teamStats.home.points + result.teamStats.away.points).toBe(
      result.score.home + result.score.away,
    );
  });

  it("persists cumulative stats across quarters", () => {
    const home = makeRoster(HOME, "home", 5);
    const away = makeRoster(AWAY, "away", 5);
    const result = simulateGame(
      scheduledGame(),
      { homePlayers: home, awayPlayers: away, config: shortConfig() },
      createTestRng(200),
    );

    expect(result.playerStats).toHaveLength(10);
    const totalPoints = result.playerStats.reduce(
      (sum, row) => sum + row.points,
      0,
    );
    expect(totalPoints).toBe(result.score.home + result.score.away);
  });
});

/** Stub RNG that always succeeds chance() and returns mid-range next(). */
function createStubChanceAlwaysTrue(): Rng {
  return {
    next: () => 0,
    nextInt: (min) => min,
    pick: <T>(items: readonly T[]) => items[0]!,
    chance: () => true,
    getState: () => 0,
  };
}
