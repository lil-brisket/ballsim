import { describe, expect, it } from "vitest";
import type { GameState } from "@/state/game-state";
import {
  AWARD_ELIGIBILITY_CONFIG,
  scaleSeasonMinimum,
  scaleSeasonMinimums,
} from "@/systems/awards/awards-config";
import {
  evaluateMvp,
  evaluateRoy,
  evaluateSixthMan,
} from "@/systems/awards/evaluate-awards";
import {
  addPlayerToState,
  awardWinnerId,
  createAwardsTestState,
  generatePlayerGames,
  injectGames,
  primaryTeamIds,
  withPriorSeasonHistory,
} from "./helpers";

function withSeasonLength(state: GameState, gamesPerTeam: number): GameState {
  return {
    ...state,
    settings: {
      ...state.settings,
      regularSeason: { ...state.settings.regularSeason, gamesPerTeam },
    },
  };
}

const LINE = { points: 24, rebounds: 7, assists: 5, minutes: 34 };

describe("scaleSeasonMinimum", () => {
  it("keeps full-length and longer seasons unchanged", () => {
    expect(scaleSeasonMinimum(50, 82)).toBe(50);
    expect(scaleSeasonMinimum(1200, 82)).toBe(1200);
    expect(scaleSeasonMinimum(50, 100)).toBe(50);
  });

  it("scales short seasons in proportion, never below 1", () => {
    expect(scaleSeasonMinimum(50, 22)).toBe(13);
    expect(scaleSeasonMinimum(1200, 22)).toBe(322);
    expect(scaleSeasonMinimum(30, 22)).toBe(8);
    expect(scaleSeasonMinimum(600, 22)).toBe(161);
    expect(scaleSeasonMinimum(1, 14)).toBe(1);
  });

  it("scales only min* fields of a threshold group", () => {
    const scaled = scaleSeasonMinimums(
      {
        minGames: AWARD_ELIGIBILITY_CONFIG.sixthMan.minGames,
        minMinutes: AWARD_ELIGIBILITY_CONFIG.sixthMan.minMinutes,
        maxStartPct: AWARD_ELIGIBILITY_CONFIG.sixthMan.maxStartPct,
      },
      22,
    );
    expect(scaled).toEqual({ minGames: 8, minMinutes: 161, maxStartPct: 0.25 });
  });
});

describe("year-end awards in a short season", () => {
  function league(gamesPerTeam: number, games: number, benchGames = 0) {
    let state = withSeasonLength(createAwardsTestState(), gamesPerTeam);
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "regular", teamA);
    state = addPlayerToState(state, "cameo", teamB);
    state = addPlayerToState(state, "bench", teamB);
    return injectGames(state, [
      ...generatePlayerGames({
        playerId: "regular",
        teamId: teamA,
        opponentId: teamB,
        count: games,
        datePrefix: "2026-11",
        perGame: LINE,
      }),
      ...generatePlayerGames({
        playerId: "cameo",
        teamId: teamB,
        opponentId: teamA,
        count: 10,
        datePrefix: "2026-12",
        perGame: { points: 40, rebounds: 12, assists: 10, minutes: 40 },
      }),
      ...(benchGames > 0
        ? generatePlayerGames({
            playerId: "bench",
            teamId: teamB,
            opponentId: teamA,
            count: benchGames,
            datePrefix: "2027-01",
            perGame: {
              points: 14,
              rebounds: 4,
              assists: 3,
              minutes: 24,
              started: false,
            },
          })
        : []),
    ]);
  }

  it("awards MVP in a 22-game league to a player who played most of it", () => {
    const result = evaluateMvp(league(22, 20));
    expect(awardWinnerId(result)).toBe("regular");
    // A 10-game player stays below the scaled minimum (13 games).
    expect(result!.candidates.map((c) => c.subjectId)).not.toContain("cameo");
  });

  it("keeps an 82-game league's MVP minimum at exactly 50 games", () => {
    expect(evaluateMvp(league(82, 49))).toBeNull();
    expect(awardWinnerId(evaluateMvp(league(82, 50)))).toBe("regular");
  });

  it("puts a 22-game league's MVP minimum at 13 games", () => {
    // 12 and 10 games (regular, cameo) both fall short.
    expect(evaluateMvp(league(22, 12))).toBeNull();
    expect(awardWinnerId(evaluateMvp(league(22, 13)))).toBe("regular");
  });

  it("awards ROY in a 22-game league, counting a short prior season", () => {
    let state = withSeasonLength(createAwardsTestState(), 22);
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "rookie", teamA, { age: 21 });
    state = addPlayerToState(state, "second_year", teamB, { age: 22 });
    // A 20-game season last year qualifies at the scaled 8 games / 161 min,
    // so this young player already had his rookie year.
    state = withPriorSeasonHistory(state, "second_year", 2025, {
      games: 20,
      minutes: 600,
      points: 300,
    });
    state = injectGames(state, [
      ...generatePlayerGames({
        playerId: "rookie",
        teamId: teamA,
        opponentId: teamB,
        count: 15,
        datePrefix: "2026-11",
        perGame: { points: 14, rebounds: 4, assists: 3, minutes: 26 },
      }),
      ...generatePlayerGames({
        playerId: "second_year",
        teamId: teamB,
        opponentId: teamA,
        count: 15,
        datePrefix: "2026-11",
        perGame: { points: 24, rebounds: 6, assists: 5, minutes: 34 },
      }),
    ]);
    expect(awardWinnerId(evaluateRoy(state))).toBe("rookie");
  });

  it("awards Sixth Man in a 22-game league", () => {
    const result = evaluateSixthMan(league(22, 20, 18));
    expect(awardWinnerId(result)).toBe("bench");
  });
});
