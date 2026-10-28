import { describe, expect, it } from "vitest";
import { asPlayerId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { buildAwardResultId } from "@/domain/entities/awards";
import { computeAwardReputationBonus } from "@/systems/awards/award-reputation";
import {
  AWARD_METRIC_VERSION,
  AWARD_REPUTATION_CONFIG,
} from "@/systems/awards/awards-config";
import type { GameState } from "@/state/game-state";
import { defaultEvaluatePlayerInterest } from "@/systems/free-agency";
import {
  addPlayerToState,
  createAwardsTestState,
  primaryTeamIds,
} from "./helpers";

function seedAward(
  state: ReturnType<typeof createAwardsTestState>,
  playerId: string,
  awardId: "mvp" | "player_of_month" | "dpoy",
  seasonYear: number,
  period: string | null = null,
) {
  const [teamA] = primaryTeamIds(state);
  const id = buildAwardResultId(
    state.world.league.id,
    seasonYear,
    period,
    awardId,
  );
  return {
    ...state,
    business: {
      ...state.business,
      awards: {
        results: {
          ...state.business.awards.results,
          [id]: {
            id,
            awardId,
            cadence: period ? ("monthly" as const) : ("yearly" as const),
            leagueId: state.world.league.id,
            seasonId: state.competition.season.id,
            seasonYear,
            period,
            winner: {
              subjectType: "player" as const,
              subjectId: asPlayerId(playerId),
              teamId: teamA,
            },
            candidates: [
              {
                subjectId: asPlayerId(playerId),
                teamId: teamA,
                rank: 1,
                score: 90,
              },
            ],
            context: {
              winnerScore: 90,
              breakdown: {},
              metricVersion: AWARD_METRIC_VERSION,
              statSnapshot: {
                games: 60,
                minutes: 2000,
                totals: {
                  games: 60,
                  minutes: 2000,
                  points: 1200,
                  rebounds: 400,
                  assists: 300,
                  steals: 60,
                  blocks: 40,
                  turnovers: 120,
                  fgMade: 450,
                  fgAttempted: 1000,
                  threeMade: 100,
                  threeAttempted: 300,
                  ftMade: 200,
                  ftAttempted: 250,
                },
                perGame: {
                  points: 20,
                  rebounds: 6,
                  assists: 5,
                  steals: 1,
                  blocks: 0.6,
                  turnovers: 2,
                  minutes: 33,
                },
                efficiency: { tsPct: 0.55, eFgPct: 0.5, astTo: 2.5 },
                teamRecord: { wins: 45, losses: 37, winPct: 45 / 82 },
                teamRank: 8,
                scoringBreakdown: {},
                metricVersion: AWARD_METRIC_VERSION,
              },
            },
          },
        },
      },
    },
  };
}

describe("award reputation / FA", () => {
  it("increases interest score without changing OVR", () => {
    let state = createAwardsTestState({ seasonYear: 2030 });
    const [teamA] = primaryTeamIds(state);
    state = addPlayerToState(state, "mvp_guy", teamA);
    const player = state.world.players.mvp_guy!;
    const ovrBefore = calculatePlayerOverall(
      player.position,
      player.attributes,
    );
    state = seedAward(state, "mvp_guy", "mvp", 2030);
    const ovrAfter = calculatePlayerOverall(
      state.world.players.mvp_guy!.position,
      state.world.players.mvp_guy!.attributes,
    );
    expect(ovrAfter).toBe(ovrBefore);

    const interest = defaultEvaluatePlayerInterest(
      asPlayerId("mvp_guy"),
      teamA,
      state,
    );
    expect(interest.factors.reputation).toBeGreaterThan(0);
    expect(interest.score).toBeGreaterThan(50);
  });

  it("applies recency decay and smaller monthly weights", () => {
    let state = createAwardsTestState({ seasonYear: 2035 });
    const [teamA] = primaryTeamIds(state);
    state = addPlayerToState(state, "p1", teamA);
    state = seedAward(state, "p1", "mvp", 2035);
    const recent = computeAwardReputationBonus(asPlayerId("p1"), state);

    let oldState = createAwardsTestState({ seasonYear: 2035 });
    oldState = addPlayerToState(oldState, "p2", teamA);
    oldState = seedAward(oldState, "p2", "mvp", 2026);
    const old = computeAwardReputationBonus(asPlayerId("p2"), oldState);
    expect(recent).toBeGreaterThan(old);

    let monthlyState = createAwardsTestState({ seasonYear: 2035 });
    monthlyState = addPlayerToState(monthlyState, "p3", teamA);
    monthlyState = seedAward(
      monthlyState,
      "p3",
      "player_of_month",
      2035,
      "2035-01",
    );
    const monthly = computeAwardReputationBonus(asPlayerId("p3"), monthlyState);
    expect(monthly).toBeLessThan(recent);
    expect(monthly).toBeLessThanOrEqual(
      AWARD_REPUTATION_CONFIG.weights.player_of_month,
    );
  });

  it("caps total bonus", () => {
    let state = createAwardsTestState({ seasonYear: 2030 });
    const [teamA] = primaryTeamIds(state);
    state = addPlayerToState(state, "goat", teamA);
    for (let y = 2025; y <= 2030; y += 1) {
      state = seedAward(state, "goat", "mvp", y);
      state = seedAward(state, "goat", "dpoy", y);
    }
    const bonus = computeAwardReputationBonus(asPlayerId("goat"), state);
    expect(bonus).toBeLessThanOrEqual(AWARD_REPUTATION_CONFIG.maxBonus);
  });

  it("weights year-end awards by the season they were won in", () => {
    const withLength = (state: GameState, gamesPerTeam: number): GameState => ({
      ...state,
      settings: {
        ...state.settings,
        regularSeason: { ...state.settings.regularSeason, gamesPerTeam },
      },
    });
    /** Award won over a season of `wonOver` games; league plays `today`. */
    const bonusFor = (
      today: number,
      wonOver: number,
      awardId: "mvp" | "player_of_month",
      period: string | null = null,
    ) => {
      let state = withLength(
        createAwardsTestState({ seasonYear: 2030 }),
        today,
      );
      const [teamA] = primaryTeamIds(state);
      state = addPlayerToState(state, "winner", teamA);
      state = seedAward(state, "winner", awardId, 2030, period);
      const results = Object.fromEntries(
        Object.entries(state.business.awards.results).map(([id, result]) => [
          id,
          {
            ...result,
            context: {
              ...result.context,
              statSnapshot: {
                ...result.context.statSnapshot,
                teamRecord: {
                  wins: Math.ceil(wonOver / 2),
                  losses: Math.floor(wonOver / 2),
                  winPct: 0.5,
                },
              },
            },
          },
        ]),
      );
      state = {
        ...state,
        business: { ...state.business, awards: { results } },
      };
      return computeAwardReputationBonus(asPlayerId("winner"), state);
    };

    const mvp = AWARD_REPUTATION_CONFIG.weights.mvp;
    expect(bonusFor(82, 82, "mvp")).toBeCloseTo(mvp);
    expect(bonusFor(22, 22, "mvp")).toBeCloseTo((mvp * 22) / 82);
    // A later change of schedule length does not re-weight past awards.
    expect(bonusFor(22, 82, "mvp")).toBeCloseTo(mvp);
    expect(bonusFor(82, 22, "mvp")).toBeCloseTo((mvp * 22) / 82);
    const monthly = AWARD_REPUTATION_CONFIG.weights.player_of_month;
    expect(bonusFor(82, 82, "player_of_month", "2030-01")).toBeCloseTo(monthly);
    expect(bonusFor(22, 22, "player_of_month", "2030-01")).toBeCloseTo(monthly);
  });
});
