import { describe, expect, it } from "vitest";
import {
  evaluateDefensivePlayerOfMonth,
  evaluatePlayerOfMonth,
  evaluateRookieOfMonth,
} from "@/systems/awards/evaluate-awards";
import { runMonthlyAwards } from "@/systems/awards/award-pipeline";
import {
  addPlayerToState,
  awardWinnerId,
  createAwardsTestState,
  generatePlayerGames,
  injectGames,
  primaryTeamIds,
} from "./helpers";

describe("monthly awards", () => {
  it("awards Player of the Month to the stronger monthly performer", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "star", teamA);
    state = addPlayerToState(state, "role", teamB);
    const starGames = generatePlayerGames({
      playerId: "star",
      teamId: teamA,
      opponentId: teamB,
      count: 8,
      datePrefix: "2026-01",
      perGame: {
        points: 32,
        rebounds: 8,
        assists: 7,
        minutes: 36,
        fieldGoalsMade: 12,
        fieldGoalsAttempted: 22,
      },
    });
    const roleGames = generatePlayerGames({
      playerId: "role",
      teamId: teamB,
      opponentId: teamA,
      count: 8,
      datePrefix: "2026-01",
      perGame: {
        points: 12,
        rebounds: 4,
        assists: 2,
        minutes: 24,
        fieldGoalsMade: 5,
        fieldGoalsAttempted: 12,
      },
      startWins: false,
    });
    state = injectGames(state, [...starGames, ...roleGames]);
    const result = evaluatePlayerOfMonth(state, "2026-01");
    expect(awardWinnerId(result)).toBe("star");
    expect(result?.candidates[0]?.rank).toBe(1);
    expect(result?.candidates.length).toBeGreaterThanOrEqual(1);
  });

  it("uses monthly team record, not season-to-date carryover", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "hot_team_cold", teamA);
    state = addPlayerToState(state, "avg_team_hot", teamB);

    // December: team A dominates (carryover should NOT help January POTM)
    const dec = generatePlayerGames({
      playerId: "hot_team_cold",
      teamId: teamA,
      opponentId: teamB,
      count: 10,
      datePrefix: "2025-12",
      perGame: { points: 20, minutes: 30 },
    });
    // January: cold player on hot team vs hot player on average team
    const janCold = generatePlayerGames({
      playerId: "hot_team_cold",
      teamId: teamA,
      opponentId: teamB,
      count: 6,
      datePrefix: "2026-01",
      perGame: {
        points: 10,
        rebounds: 2,
        assists: 1,
        minutes: 28,
        fieldGoalsMade: 4,
        fieldGoalsAttempted: 14,
      },
      startWins: true,
    });
    const janHot = generatePlayerGames({
      playerId: "avg_team_hot",
      teamId: teamB,
      opponentId: teamA,
      count: 6,
      datePrefix: "2026-01",
      perGame: {
        points: 30,
        rebounds: 9,
        assists: 8,
        minutes: 36,
        fieldGoalsMade: 11,
        fieldGoalsAttempted: 20,
      },
      startWins: false,
    });
    state = injectGames(state, [...dec, ...janCold, ...janHot]);
    const result = evaluatePlayerOfMonth(state, "2026-01");
    expect(awardWinnerId(result)).toBe("avg_team_hot");
  });

  it("is idempotent when run twice", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "star", teamA);
    state = injectGames(
      state,
      generatePlayerGames({
        playerId: "star",
        teamId: teamA,
        opponentId: teamB,
        count: 6,
        datePrefix: "2026-02",
        perGame: { points: 25, minutes: 34, rebounds: 6, assists: 5 },
      }),
    );
    const first = runMonthlyAwards(state, "2026-02");
    const second = runMonthlyAwards(first.state, "2026-02");
    const potmIds = Object.keys(second.state.business.awards.results).filter(
      (id) => id.endsWith(":player_of_month"),
    );
    expect(potmIds).toHaveLength(1);
    expect(second.awardsGenerated).toBe(0);
  });

  it("skips months with no primary games", () => {
    const state = createAwardsTestState();
    const result = runMonthlyAwards(state, "2026-07");
    expect(result.awardsGenerated).toBe(0);
  });

  it("awards Rookie of the Month only to rookies", () => {
    let state = createAwardsTestState({ seasonYear: 2026 });
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "rookie", teamA);
    state = addPlayerToState(state, "vet", teamB);
    // Vet has prior qualifying season
    state = {
      ...state,
      business: {
        ...state.business,
        playerHistory: {
          vet: {
            playerId: "vet" as never,
            trackingStartedSeasonYear: 2025,
            seasons: [
              {
                seasonId: "season_2025" as never,
                seasonYear: 2025,
                age: 24,
                overall: 75,
                attributes: state.world.players.vet!.attributes,
                developmentStage: "prime",
                injuryKind: "available",
                contractSnapshot: {
                  contractId: null,
                  salary: null,
                  teamId: teamB,
                },
                competition: {
                  regular: {
                    games: 70,
                    minutes: 2000,
                    points: 1000,
                    rebounds: 300,
                    assists: 200,
                    steals: 50,
                    blocks: 20,
                    turnovers: 100,
                    fgMade: 400,
                    fgAttempted: 900,
                    threeMade: 100,
                    threeAttempted: 300,
                    ftMade: 100,
                    ftAttempted: 120,
                  },
                  playoffs: {
                    games: 0,
                    minutes: 0,
                    points: 0,
                    rebounds: 0,
                    assists: 0,
                    steals: 0,
                    blocks: 0,
                    turnovers: 0,
                    fgMade: 0,
                    fgAttempted: 0,
                    threeMade: 0,
                    threeAttempted: 0,
                    ftMade: 0,
                    ftAttempted: 0,
                  },
                  development: {
                    games: 0,
                    minutes: 0,
                    points: 0,
                    rebounds: 0,
                    assists: 0,
                    steals: 0,
                    blocks: 0,
                    turnovers: 0,
                    fgMade: 0,
                    fgAttempted: 0,
                    threeMade: 0,
                    threeAttempted: 0,
                    ftMade: 0,
                    ftAttempted: 0,
                  },
                  combined: {
                    games: 70,
                    minutes: 2000,
                    points: 1000,
                    rebounds: 300,
                    assists: 200,
                    steals: 50,
                    blocks: 20,
                    turnovers: 100,
                    fgMade: 400,
                    fgAttempted: 900,
                    threeMade: 100,
                    threeAttempted: 300,
                    ftMade: 100,
                    ftAttempted: 120,
                  },
                },
              },
            ],
          },
        },
      },
    };
    state = injectGames(state, [
      ...generatePlayerGames({
        playerId: "rookie",
        teamId: teamA,
        opponentId: teamB,
        count: 5,
        datePrefix: "2026-03",
        perGame: { points: 18, minutes: 28, rebounds: 5, assists: 4 },
      }),
      ...generatePlayerGames({
        playerId: "vet",
        teamId: teamB,
        opponentId: teamA,
        count: 5,
        datePrefix: "2026-03",
        perGame: { points: 28, minutes: 34, rebounds: 7, assists: 6 },
      }),
    ]);
    const result = evaluateRookieOfMonth(state, "2026-03");
    expect(awardWinnerId(result)).toBe("rookie");
  });

  it("does not award DPOM for steals alone when overall defense is weak", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "steal_only", teamA);
    state = addPlayerToState(state, "balanced_d", teamB);
    state = injectGames(state, [
      ...generatePlayerGames({
        playerId: "steal_only",
        teamId: teamA,
        opponentId: teamB,
        count: 6,
        datePrefix: "2026-01",
        perGame: {
          points: 8,
          minutes: 28,
          steals: 3,
          blocks: 0,
          rebounds: 2,
        },
      }),
      ...generatePlayerGames({
        playerId: "balanced_d",
        teamId: teamB,
        opponentId: teamA,
        count: 6,
        datePrefix: "2026-01",
        perGame: {
          points: 12,
          minutes: 32,
          steals: 2,
          blocks: 2,
          rebounds: 10,
          defensiveRebounds: 8,
        },
      }),
    ]);
    const result = evaluateDefensivePlayerOfMonth(state, "2026-01");
    expect(awardWinnerId(result)).toBe("balanced_d");
  });
});
