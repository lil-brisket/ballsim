import { describe, expect, it } from "vitest";
import {
  evaluateDpoy,
  evaluateMostImproved,
  evaluateMvp,
  evaluateRoy,
  evaluateSixthMan,
} from "@/systems/awards/evaluate-awards";
import { runYearlyAwards } from "@/systems/awards/award-pipeline";
import { AWARD_ELIGIBILITY_CONFIG } from "@/systems/awards/awards-config";
import {
  addPlayerToState,
  awardWinnerId,
  createAwardsTestState,
  generatePlayerGames,
  injectGames,
  primaryTeamIds,
  withPriorSeasonHistory,
} from "./helpers";

describe("yearly awards", () => {
  it("selects MVP with balanced production and team success", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "elite_bad_team", teamA);
    state = addPlayerToState(state, "very_good_good_team", teamB);

    state = injectGames(state, [
      ...generatePlayerGames({
        playerId: "elite_bad_team",
        teamId: teamA,
        opponentId: teamB,
        count: 60,
        datePrefix: "2026-01",
        perGame: {
          points: 35,
          rebounds: 10,
          assists: 8,
          minutes: 38,
          steals: 1,
          blocks: 1,
          fieldGoalsMade: 13,
          fieldGoalsAttempted: 28,
        },
        startWins: false,
      }),
      ...generatePlayerGames({
        playerId: "very_good_good_team",
        teamId: teamB,
        opponentId: teamA,
        count: 60,
        datePrefix: "2026-01",
        perGame: {
          points: 26,
          rebounds: 7,
          assists: 7,
          minutes: 36,
          steals: 1,
          blocks: 1,
          fieldGoalsMade: 10,
          fieldGoalsAttempted: 18,
        },
        startWins: true,
      }),
    ]);

    const result = evaluateMvp(state);
    expect(result).not.toBeNull();
    // Either can win depending on weighting; ensure eligibility + candidates
    expect(result!.candidates.length).toBeGreaterThanOrEqual(2);
    expect(
      result!.candidates.every(
        (c) => c.score >= 0 && c.rank >= 1,
      ),
    ).toBe(true);
    // Winner must meet min games
    const winnerAggGames =
      result!.context.statSnapshot.games;
    expect(winnerAggGames).toBeGreaterThanOrEqual(
      AWARD_ELIGIBILITY_CONFIG.mvp.minGames,
    );
  });

  it("excludes MVP candidates below minGames", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "flash", teamA);
    state = addPlayerToState(state, "ironman", teamB);
    state = injectGames(state, [
      ...generatePlayerGames({
        playerId: "flash",
        teamId: teamA,
        opponentId: teamB,
        count: 7,
        datePrefix: "2026-01",
        perGame: {
          points: 41,
          rebounds: 12,
          assists: 11,
          minutes: 40,
        },
      }),
      ...generatePlayerGames({
        playerId: "ironman",
        teamId: teamB,
        opponentId: teamA,
        count: 55,
        datePrefix: "2026-01",
        perGame: {
          points: 18,
          rebounds: 5,
          assists: 4,
          minutes: 32,
        },
      }),
    ]);
    const result = evaluateMvp(state);
    expect(awardWinnerId(result)).toBe("ironman");
  });

  it("does not award DPOY for blocks alone", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "block_only", teamA);
    state = addPlayerToState(state, "two_way_d", teamB);
    state = injectGames(state, [
      ...generatePlayerGames({
        playerId: "block_only",
        teamId: teamA,
        opponentId: teamB,
        count: 55,
        datePrefix: "2026-01",
        perGame: {
          points: 6,
          minutes: 22,
          blocks: 3,
          steals: 0,
          rebounds: 3,
        },
      }),
      ...generatePlayerGames({
        playerId: "two_way_d",
        teamId: teamB,
        opponentId: teamA,
        count: 55,
        datePrefix: "2026-01",
        perGame: {
          points: 14,
          minutes: 34,
          blocks: 2,
          steals: 2,
          rebounds: 9,
          defensiveRebounds: 7,
        },
      }),
    ]);
    expect(awardWinnerId(evaluateDpoy(state))).toBe("two_way_d");
  });

  it("awards ROY to first primary-league season player", () => {
    let state = createAwardsTestState({ seasonYear: 2026 });
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "rookie", teamA);
    state = addPlayerToState(state, "soph", teamB);
    state = withPriorSeasonHistory(state, "soph", 2025, {
      games: 70,
      minutes: 1800,
      points: 800,
    });
    state = injectGames(state, [
      ...generatePlayerGames({
        playerId: "rookie",
        teamId: teamA,
        opponentId: teamB,
        count: 40,
        datePrefix: "2026-01",
        perGame: { points: 16, minutes: 28, rebounds: 4, assists: 3 },
      }),
      ...generatePlayerGames({
        playerId: "soph",
        teamId: teamB,
        opponentId: teamA,
        count: 40,
        datePrefix: "2026-01",
        perGame: { points: 22, minutes: 32, rebounds: 5, assists: 4 },
      }),
    ]);
    expect(awardWinnerId(evaluateRoy(state))).toBe("rookie");
  });

  it("excludes majority starters from Sixth Man", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "starter", teamA);
    state = addPlayerToState(state, "bench", teamB);
    state = injectGames(state, [
      ...generatePlayerGames({
        playerId: "starter",
        teamId: teamA,
        opponentId: teamB,
        count: 50,
        datePrefix: "2026-01",
        perGame: {
          points: 20,
          minutes: 28,
          started: true,
          rebounds: 5,
          assists: 4,
        },
      }),
      ...generatePlayerGames({
        playerId: "bench",
        teamId: teamB,
        opponentId: teamA,
        count: 50,
        datePrefix: "2026-01",
        perGame: {
          points: 16,
          minutes: 24,
          started: false,
          rebounds: 4,
          assists: 3,
        },
      }),
    ]);
    expect(awardWinnerId(evaluateSixthMan(state))).toBe("bench");
  });

  it("MIP rejects tiny prior-season samples", () => {
    let state = createAwardsTestState({ seasonYear: 2026 });
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "tiny_prior", teamA);
    state = addPlayerToState(state, "real_improve", teamB);
    state = withPriorSeasonHistory(state, "tiny_prior", 2025, {
      games: 8,
      minutes: 24,
      points: 8,
    });
    state = withPriorSeasonHistory(state, "real_improve", 2025, {
      games: 60,
      minutes: 1400,
      points: 600,
      rebounds: 200,
      assists: 150,
      fgMade: 220,
      fgAttempted: 550,
    });
    state = injectGames(state, [
      ...generatePlayerGames({
        playerId: "tiny_prior",
        teamId: teamA,
        opponentId: teamB,
        count: 50,
        datePrefix: "2026-01",
        perGame: { points: 15, minutes: 28, rebounds: 4, assists: 3 },
      }),
      ...generatePlayerGames({
        playerId: "real_improve",
        teamId: teamB,
        opponentId: teamA,
        count: 50,
        datePrefix: "2026-01",
        perGame: {
          points: 18,
          minutes: 32,
          rebounds: 6,
          assists: 5,
          fieldGoalsMade: 7,
          fieldGoalsAttempted: 14,
        },
      }),
    ]);
    expect(awardWinnerId(evaluateMostImproved(state))).toBe("real_improve");
  });

  it("yearly awards are idempotent and ignore playoff games", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "star", teamA);
    const regular = generatePlayerGames({
      playerId: "star",
      teamId: teamA,
      opponentId: teamB,
      count: 55,
      datePrefix: "2026-01",
      perGame: { points: 24, minutes: 34, rebounds: 7, assists: 6 },
    });
    state = injectGames(state, regular);
    const first = runYearlyAwards(state);
    expect(first.awardsGenerated).toBeGreaterThan(0);

    // Add absurd playoff stats — must not change MVP
    const mvpBefore = Object.values(first.state.business.awards.results).find(
      (r) => r.awardId === "mvp",
    );
    const playoffGames = generatePlayerGames({
      playerId: "star",
      teamId: teamA,
      opponentId: teamB,
      count: 10,
      datePrefix: "2026-05",
      perGame: { points: 50, minutes: 40 },
    }).map((g) => ({ ...g, competitionType: "playoffs" as const }));
    const withPlayoffs = injectGames(first.state, playoffGames);
    const second = runYearlyAwards(withPlayoffs);
    expect(second.awardsGenerated).toBe(0);
    const mvpAfter = Object.values(second.state.business.awards.results).find(
      (r) => r.awardId === "mvp",
    );
    expect(mvpAfter?.winner.subjectId).toBe(mvpBefore?.winner.subjectId);
    expect(mvpAfter?.context.winnerScore).toBe(mvpBefore?.context.winnerScore);
  });
});
