import { describe, expect, it } from "vitest";
import type { GameState } from "@/state/game-state";
import {
  awardRaceThroughDate,
  evaluateAwardRace,
} from "@/systems/awards/award-race";
import { evaluatePlayerOfMonth } from "@/systems/awards/evaluate-awards";
import {
  addPlayerToState,
  boxRow,
  createAwardsTestState,
  generatePlayerGames,
  injectGames,
  makeFinalGame,
  primaryTeamIds,
} from "./helpers";

const PER_GAME = {
  points: 24,
  rebounds: 6,
  assists: 5,
  minutes: 34,
  fieldGoalsMade: 9,
  fieldGoalsAttempted: 18,
};

function withSeed(state: GameState, rngSeed: number): GameState {
  return { ...state, meta: { ...state.meta, rngSeed } };
}

/** Five players with identical January lines: every race is a dead heat. */
function deadHeatState(): GameState {
  let state = createAwardsTestState();
  const [teamA, teamB] = primaryTeamIds(state);
  const ids = ["p_a", "p_b", "p_c", "p_d", "p_e"];
  for (const id of ids) {
    state = addPlayerToState(state, id, teamA);
  }
  return injectGames(
    state,
    ids.flatMap((playerId) =>
      generatePlayerGames({
        playerId,
        teamId: teamA,
        opponentId: teamB,
        count: 8,
        datePrefix: "2026-01",
        perGame: PER_GAME,
      }),
    ),
  );
}

describe("award vote", () => {
  it("lets a tight race go to someone other than the score leader", () => {
    const base = deadHeatState();
    const winners = new Set<string>();
    for (let seed = 1; seed <= 20; seed += 1) {
      const result = evaluatePlayerOfMonth(withSeed(base, seed), "2026-01")!;
      winners.add(result.winner.subjectId);
      // The voted winner is always stored as rank 1.
      expect(result.candidates[0]!.subjectId).toBe(result.winner.subjectId);
      expect(result.candidates.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5]);
    }
    expect(winners.size).toBeGreaterThan(1);
  });

  it("replays the same winner for the same save seed", () => {
    const state = withSeed(deadHeatState(), 7);
    const first = evaluatePlayerOfMonth(state, "2026-01")!;
    const second = evaluatePlayerOfMonth(state, "2026-01")!;
    expect(second.winner).toEqual(first.winner);
    expect(second.candidates).toEqual(first.candidates);
  });

  it("does not let a runaway leader lose", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "star", teamA);
    state = addPlayerToState(state, "role", teamB);
    state = injectGames(state, [
      ...generatePlayerGames({
        playerId: "star",
        teamId: teamA,
        opponentId: teamB,
        count: 8,
        datePrefix: "2026-01",
        perGame: { ...PER_GAME, points: 34, assists: 9 },
      }),
      ...generatePlayerGames({
        playerId: "role",
        teamId: teamB,
        opponentId: teamA,
        count: 8,
        datePrefix: "2026-01",
        perGame: { ...PER_GAME, points: 8, assists: 1 },
        startWins: false,
      }),
    ]);
    for (let seed = 1; seed <= 20; seed += 1) {
      const result = evaluatePlayerOfMonth(withSeed(state, seed), "2026-01")!;
      expect(result.winner.subjectId).toBe("star");
    }
  });
});

describe("award race", () => {
  it("cuts off at the last completed Monday-Sunday week", () => {
    // 2026-01-11 is a Sunday.
    expect(awardRaceThroughDate("2026-01-12")).toBe("2026-01-11");
    expect(awardRaceThroughDate("2026-01-14")).toBe("2026-01-11");
    expect(awardRaceThroughDate("2026-01-17")).toBe("2026-01-11");
    expect(awardRaceThroughDate("2026-01-11")).toBe("2026-01-04");
  });

  it("ranks contenders by score from games through the cut-off only", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "early", teamA);
    state = addPlayerToState(state, "steady", teamB);
    state = addPlayerToState(state, "late", teamB);
    const lateGames = Array.from({ length: 6 }, (_, i) =>
      makeFinalGame({
        id: `game_late_${i}`,
        date: `2026-01-${String(13 + i).padStart(2, "0")}`,
        homeTeamId: teamB,
        awayTeamId: teamA,
        homeScore: 110,
        awayScore: 90,
        playerStats: [boxRow("late", teamB, { ...PER_GAME, points: 40 })],
      }),
    );
    state = injectGames(state, [
      ...generatePlayerGames({
        playerId: "early",
        teamId: teamA,
        opponentId: teamB,
        count: 6,
        datePrefix: "2026-01",
        perGame: { ...PER_GAME, points: 30 },
      }),
      ...generatePlayerGames({
        playerId: "steady",
        teamId: teamB,
        opponentId: teamA,
        count: 6,
        datePrefix: "2026-01",
        perGame: { ...PER_GAME, points: 12 },
        startWins: false,
      }),
      ...lateGames,
    ]);
    state = {
      ...state,
      world: {
        ...state.world,
        calendar: { ...state.world.calendar, currentDate: "2026-01-21" },
      },
    };

    const race = evaluateAwardRace(state, "player_of_month", {
      throughDate: awardRaceThroughDate("2026-01-21"),
    })!;
    expect(race.period).toBe("2026-01");
    expect(race.throughDate).toBe("2026-01-18");
    const ids = race.contenders.map((c) => c.subjectId);
    expect(ids).toContain("late");

    const earlier = evaluateAwardRace(state, "player_of_month", {
      throughDate: "2026-01-11",
    })!;
    expect(earlier.contenders.map((c) => c.subjectId)).toEqual([
      "early",
      "steady",
    ]);
    expect(earlier.contenders.map((c) => c.rank)).toEqual([1, 2]);
    expect(earlier.contenders[0]!.score).toBeGreaterThan(
      earlier.contenders[1]!.score,
    );
  });

  it("has no race for retired midseason awards", () => {
    const state = deadHeatState();
    expect(
      evaluateAwardRace(state, "midseason_mvp", { throughDate: "2026-01-11" }),
    ).toBeNull();
  });
});
