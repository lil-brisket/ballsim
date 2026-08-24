import { describe, expect, it } from "vitest";
import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import type { FranchiseSeasonRecord } from "@/domain/entities/franchise-history";
import { asSeasonId, asTeamId } from "@/domain/ids";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createSeededRng } from "@/domain/rng";
import {
  buildFranchiseTrajectoryContext,
  emptyFranchiseTrajectoryContext,
} from "@/systems/franchise-trajectory-context";

function season(input: {
  year: number;
  wins: number;
  losses: number;
  attendance?: number;
  cash?: number;
  revenue?: number;
  franchiseValue?: number;
  fanSentiment?: number;
  playoffResult?: FranchiseSeasonRecord["playoffResult"];
}): FranchiseSeasonRecord {
  const facilityLevels = {} as Record<FacilityCategory, number>;
  for (const category of FACILITY_CATEGORIES) {
    facilityLevels[category] = 2;
  }
  return {
    seasonId: asSeasonId(`season_${input.year}`),
    seasonYear: input.year,
    wins: input.wins,
    losses: input.losses,
    playoffResult: input.playoffResult ?? "missed",
    championship: false,
    revenue: input.revenue ?? 80_000_000,
    attendance: input.attendance ?? 500_000,
    cash: input.cash ?? 40_000_000,
    fanSentiment: input.fanSentiment ?? 50,
    reputation: 50,
    facilityLevels,
    relocated: false,
    city: "Testville",
    name: "Testers",
    notableEventIds: [],
    franchiseValue: input.franchiseValue ?? 800_000_000,
  };
}

describe("buildFranchiseTrajectoryContext", () => {
  it("returns empty defaults when requested", () => {
    const empty = emptyFranchiseTrajectoryContext();
    expect(empty.rebuildPressure).toBeGreaterThan(0);
    expect(empty.competitiveWindow).toBeGreaterThan(0);
  });

  it("raises rebuildPressure after consecutive losing seasons", () => {
    let state = createTestGameState({ saveId: "traj_rebuild" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = Object.keys(state.world.teams)[0]!;

    state = {
      ...state,
      business: {
        ...state.business,
        franchiseHistory: {
          ...state.business.franchiseHistory,
          [teamId]: {
            teamId: asTeamId(teamId),
            seasons: [
              season({ year: 2020, wins: 22, losses: 60, franchiseValue: 900_000_000 }),
              season({
                year: 2021,
                wins: 20,
                losses: 62,
                franchiseValue: 850_000_000,
                attendance: 420_000,
              }),
              season({
                year: 2022,
                wins: 18,
                losses: 64,
                franchiseValue: 780_000_000,
                attendance: 380_000,
                cash: 15_000_000,
              }),
            ],
          },
        },
      },
    };

    const traj = buildFranchiseTrajectoryContext(state, asTeamId(teamId));
    expect(traj).not.toBeNull();
    expect(traj!.consecutiveLosingSeasons).toBeGreaterThanOrEqual(3);
    expect(traj!.rebuildPressure).toBeGreaterThan(0.4);
    expect(traj!.valueVsOwnBaseline).toBeLessThan(0);
  });

  it("raises competitiveWindow with winning history and financial capacity", () => {
    let state = createTestGameState({ saveId: "traj_window" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = Object.keys(state.world.teams)[0]!;

    const existing = state.competition.standings.byTeamId[teamId]!;
    state = {
      ...state,
      competition: {
        ...state.competition,
        standings: {
          ...state.competition.standings,
          byTeamId: {
            ...state.competition.standings.byTeamId,
            [teamId]: {
              ...existing,
              wins: 54,
              losses: 28,
              winPercentage: 54 / 82,
            },
          },
        },
      },
      business: {
        ...state.business,
        finances: {
          ...state.business.finances,
          [teamId]: {
            ...state.business.finances[teamId]!,
            cash: 120_000_000,
          },
        },
        franchiseHistory: {
          ...state.business.franchiseHistory,
          [teamId]: {
            teamId: asTeamId(teamId),
            seasons: [
              season({
                year: 2020,
                wins: 48,
                losses: 34,
                playoffResult: "second_round",
                franchiseValue: 950_000_000,
              }),
              season({
                year: 2021,
                wins: 52,
                losses: 30,
                playoffResult: "conference_finals",
                franchiseValue: 1_050_000_000,
              }),
              season({
                year: 2022,
                wins: 55,
                losses: 27,
                playoffResult: "finals",
                franchiseValue: 1_200_000_000,
                cash: 100_000_000,
              }),
            ],
          },
        },
      },
    };

    const traj = buildFranchiseTrajectoryContext(state, asTeamId(teamId));
    expect(traj).not.toBeNull();
    expect(traj!.competitiveWindow).toBeGreaterThan(0.4);
    expect(traj!.rebuildPressure).toBeLessThan(traj!.competitiveWindow);
  });

  it("tracks self-relative attendance decline even if absolute attendance is high", () => {
    let state = createTestGameState({ saveId: "traj_self" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = Object.keys(state.world.teams)[0]!;

    state = {
      ...state,
      business: {
        ...state.business,
        franchiseHistory: {
          ...state.business.franchiseHistory,
          [teamId]: {
            teamId: asTeamId(teamId),
            seasons: [
              season({ year: 2020, wins: 40, losses: 42, attendance: 900_000 }),
              season({ year: 2021, wins: 38, losses: 44, attendance: 850_000 }),
              season({ year: 2022, wins: 36, losses: 46, attendance: 700_000 }),
            ],
          },
        },
      },
    };

    const traj = buildFranchiseTrajectoryContext(state, asTeamId(teamId));
    expect(traj!.attendanceVsOwnBaseline).toBeLessThan(0);
  });
});
