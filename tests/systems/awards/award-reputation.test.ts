import { describe, expect, it } from "vitest";
import { asPlayerId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { buildAwardResultId } from "@/domain/entities/awards";
import { computeAwardReputationBonus } from "@/systems/awards/award-reputation";
import { AWARD_METRIC_VERSION, AWARD_REPUTATION_CONFIG } from "@/systems/awards/awards-config";
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
    const ovrBefore = calculatePlayerOverall(player.position, player.attributes);
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
    const monthly = computeAwardReputationBonus(
      asPlayerId("p3"),
      monthlyState,
    );
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
});
