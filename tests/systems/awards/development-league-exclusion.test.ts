import { describe, expect, it } from "vitest";
import { asPlayerId } from "@/domain/ids";
import {
  evaluateMvp,
  evaluatePlayerOfMonth,
  evaluateRoy,
} from "@/systems/awards/evaluate-awards";
import { runMonthlyAwards, runYearlyAwards } from "@/systems/awards/award-pipeline";
import { isRookieEligible } from "@/systems/awards/award-eligibility";
import { getPlayerAwards } from "@/state/award-selectors";
import {
  addPlayerToState,
  awardWinnerId,
  boxRow,
  createAwardsTestState,
  generatePlayerGames,
  injectDlGames,
  injectGames,
  makeFinalGame,
  primaryTeamIds,
} from "./helpers";

describe("developmental league award exclusion", () => {
  it("never uses DL games for monthly awards", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "dl_star", teamA);
    const dlGames = generatePlayerGames({
      playerId: "dl_star",
      teamId: teamA,
      opponentId: teamB,
      count: 12,
      datePrefix: "2026-01",
      perGame: { points: 40, minutes: 38, rebounds: 12, assists: 10 },
    }).map((g) => ({ ...g, competitionType: "development_league" as const }));
    state = injectDlGames(state, dlGames);
    const result = evaluatePlayerOfMonth(state, "2026-01");
    expect(result).toBeNull();
    const monthly = runMonthlyAwards(state, "2026-01");
    expect(monthly.awardsGenerated).toBe(0);
  });

  it("never uses DL stats for yearly awards / MVP", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "dl_only", teamA);
    state = addPlayerToState(state, "primary", teamB);
    const dlGames = generatePlayerGames({
      playerId: "dl_only",
      teamId: teamA,
      opponentId: teamB,
      count: 60,
      datePrefix: "2026-01",
      perGame: { points: 35, minutes: 36 },
    }).map((g) => ({ ...g, competitionType: "development_league" as const }));
    state = injectDlGames(state, dlGames);
    state = injectGames(
      state,
      generatePlayerGames({
        playerId: "primary",
        teamId: teamB,
        opponentId: teamA,
        count: 55,
        datePrefix: "2026-01",
        perGame: { points: 18, minutes: 32, rebounds: 5, assists: 4 },
      }),
    );
    expect(awardWinnerId(evaluateMvp(state))).toBe("primary");
  });

  it("DL-only season does not consume rookie eligibility", () => {
    let state = createAwardsTestState({ seasonYear: 2027 });
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "late_debut", teamA);
    // Prior season archived with only development stats (no qualifying primary)
    state = {
      ...state,
      business: {
        ...state.business,
        playerHistory: {
          late_debut: {
            playerId: asPlayerId("late_debut"),
            trackingStartedSeasonYear: 2026,
            seasons: [
              {
                seasonId: "season_2026" as never,
                seasonYear: 2026,
                age: 19,
                overall: 65,
                attributes: state.world.players.late_debut!.attributes,
                developmentStage: "developing",
                injuryKind: "available",
                contractSnapshot: {
                  contractId: null,
                  salary: null,
                  teamId: teamA,
                },
                competition: {
                  regular: {
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
                    games: 50,
                    minutes: 1500,
                    points: 900,
                    rebounds: 200,
                    assists: 150,
                    steals: 40,
                    blocks: 20,
                    turnovers: 80,
                    fgMade: 350,
                    fgAttempted: 800,
                    threeMade: 80,
                    threeAttempted: 250,
                    ftMade: 120,
                    ftAttempted: 150,
                  },
                  combined: {
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
                },
              },
            ],
          },
        },
      },
    };
    state = injectGames(
      state,
      generatePlayerGames({
        playerId: "late_debut",
        teamId: teamA,
        opponentId: teamB,
        count: 40,
        datePrefix: "2027-01",
        seasonYear: 2027,
        perGame: { points: 14, minutes: 26, rebounds: 4, assists: 3 },
      }),
    );
    expect(isRookieEligible(state, asPlayerId("late_debut"), 2027)).toBe(true);
    expect(awardWinnerId(evaluateRoy(state))).toBe("late_debut");
  });

  it("retains historical awards when player is assigned to DL", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "winner", teamA);
    state = injectGames(
      state,
      generatePlayerGames({
        playerId: "winner",
        teamId: teamA,
        opponentId: teamB,
        count: 55,
        datePrefix: "2026-01",
        perGame: { points: 28, minutes: 36, rebounds: 8, assists: 7 },
      }),
    );
    state = runYearlyAwards(state).state;
    expect(getPlayerAwards(state, asPlayerId("winner")).length).toBeGreaterThan(
      0,
    );

    // Assign to DL — awards must remain
    const player = state.world.players.winner!;
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          winner: {
            ...player,
            developmentLeague: {
              ...player.developmentLeague,
              status: "assigned",
              role: "development",
            },
          },
        },
      },
    };
    expect(getPlayerAwards(state, asPlayerId("winner")).length).toBeGreaterThan(
      0,
    );
  });

  it("does not generate developmental-league awards", () => {
    let state = createAwardsTestState();
    const [teamA, teamB] = primaryTeamIds(state);
    state = addPlayerToState(state, "dl_p", teamA);
    state = injectDlGames(state, [
      makeFinalGame({
        id: "dl_g1",
        date: "2026-01-10",
        homeTeamId: teamA,
        awayTeamId: teamB,
        homeScore: 100,
        awayScore: 90,
        competitionType: "development_league",
        playerStats: [
          boxRow("dl_p", teamA, { points: 50, minutes: 40, started: true }),
        ],
      }),
    ]);
    const yearly = runYearlyAwards(state);
    expect(
      Object.values(yearly.state.business.awards.results).every(
        (r) => !r.id.includes("development"),
      ),
    ).toBe(true);
  });
});
