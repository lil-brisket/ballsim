import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import type { Player } from "@/domain/entities/player";
import {
  asGameId,
  asPlayerId,
  asSeasonId,
  asTeamId,
  type TeamId,
} from "@/domain/ids";
import { createTestRng } from "../helpers/determinism";
import { createPlayer } from "../factories/player";
import { simulateGame } from "@/systems/game-simulation";
import {
  applyPossessionToSimState,
  assertGameSimStatsConservation,
  createGameSimState,
  finalizeGameSimState,
  lineupCacheKey,
} from "@/systems/game-sim-state";

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
    competitionType: "regular_season",
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
    id: asGameId("game_sim_state_1"),
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

describe("GameSimState", () => {
  it("applies possession deltas without calling createGame", () => {
    const home = makeRoster(HOME, "home", 5);
    const away = makeRoster(AWAY, "away", 5);
    const sim = createGameSimState({
      game: scheduledGame(),
      homePlayers: home,
      awayPlayers: away,
      homeOnCourt: home.slice(0, 5),
      awayOnCourt: away.slice(0, 5),
    });

    applyPossessionToSimState(sim, {
      pointsScored: 2,
      scoringTeamId: HOME,
      events: [
        {
          sequence: 0,
          type: "shot_made",
          playerId: home[0]!.id,
          teamId: HOME,
        },
      ],
      playerStats: [
        {
          playerId: home[0]!.id,
          points: 2,
          rebounds: 0,
          offensiveRebounds: 0,
          defensiveRebounds: 0,
          assists: 0,
          turnovers: 0,
          fouls: 0,
          fieldGoalsMade: 1,
          fieldGoalsAttempted: 1,
          threePointersMade: 0,
          threePointersAttempted: 0,
          freeThrowsMade: 0,
          freeThrowsAttempted: 0,
          touches: 1,
        },
      ],
    });

    expect(sim.homeScore).toBe(2);
    expect(sim.events).toHaveLength(1);
    expect(sim.playerStatsById.get(home[0]!.id)?.points).toBe(2);

    const homeIds = new Set(home.map((p) => p.id));
    const awayIds = new Set(away.map((p) => p.id));
    assertGameSimStatsConservation(sim, homeIds, awayIds);

    const finalized = finalizeGameSimState(sim, "final");
    expect(finalized.status).toBe("final");
    expect(finalized.score.home).toBe(2);
    expect(finalized.events).toHaveLength(1);
  });

  it("lineupCacheKey changes when lineup changes", () => {
    const home = makeRoster(HOME, "home", 6);
    const away = makeRoster(AWAY, "away", 5);
    const keyA = lineupCacheKey(home.slice(0, 5), away.slice(0, 5));
    const keyB = lineupCacheKey(
      [...home.slice(0, 4), home[5]!],
      away.slice(0, 5),
    );
    expect(keyA).not.toBe(keyB);
  });

  it("rejects invalid finalization when stats do not conserve", () => {
    const home = makeRoster(HOME, "home", 5);
    const away = makeRoster(AWAY, "away", 5);
    const sim = createGameSimState({
      game: scheduledGame(),
      homePlayers: home,
      awayPlayers: away,
      homeOnCourt: home.slice(0, 5),
      awayOnCourt: away.slice(0, 5),
    });
    sim.homeScore = 5;
    expect(() =>
      assertGameSimStatsConservation(
        sim,
        new Set(home.map((p) => p.id)),
        new Set(away.map((p) => p.id)),
      ),
    ).toThrow(/stats conservation/);
  });
});

describe("golden game determinism", () => {
  it("same seed + rosters produces identical finalized GameResult", () => {
    const home = makeRoster(HOME, "home", 7);
    const away = makeRoster(AWAY, "away", 7);
    const config = {
      regulationPeriodSeconds: 120,
      overtimePeriodSeconds: 30,
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
    };

    const a = simulateGame(
      scheduledGame(),
      { homePlayers: home, awayPlayers: away, config },
      createTestRng(12345),
    );
    const b = simulateGame(
      scheduledGame(),
      { homePlayers: home, awayPlayers: away, config },
      createTestRng(12345),
    );

    expect(b.score).toEqual(a.score);
    expect(b.periodScores).toEqual(a.periodScores);
    expect(b.possessionCounts).toEqual(a.possessionCounts);
    expect(b.events).toEqual(a.events);
    expect(b.playerStats).toEqual(a.playerStats);
    expect(b.overtimePeriodCount).toEqual(a.overtimePeriodCount);
  });
});
