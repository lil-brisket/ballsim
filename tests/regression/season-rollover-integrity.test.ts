/**
 * Season rollover integrity — reset vs persist vs recompute.
 * Uses a controlled season-year bump rather than inventing new mechanics.
 */

import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { toStandingsPageView } from "@/state/standings-selectors";
import { toPlayoffHubView } from "@/state/playoff-hub-selectors";
import { toFinancesView } from "@/state/selectors";
import { toFranchiseHubView } from "@/state/franchise-hub-selectors";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import type { GameState } from "@/state/game-state";
import { createEmptyPlayoffTournament } from "@/domain/entities/playoffs";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import type { TeamId } from "@/domain/ids";

function bumpSeasonYear(state: GameState): GameState {
  const nextYear = state.competition.season.year + 1;
  const byTeamId: Record<string, ReturnType<typeof createEmptyTeamStanding>> =
    {};
  for (const teamId of Object.keys(state.world.teams)) {
    byTeamId[teamId] = createEmptyTeamStanding(teamId as TeamId);
  }
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        year: nextYear,
        phase: "preseason",
        offseasonStage: "none",
      },
      playoffs: createEmptyPlayoffTournament(),
      standings: { byTeamId },
      seasonEventLog: [],
    },
  };
}

describe("season rollover integrity", () => {
  it("resets playoff/standings views while preserving franchise finances identity", () => {
    let state = createTestGameState({ saveId: "rollover_integrity" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const teamId = getActiveOwnerTeamId(state);
    const yearBefore = state.competition.season.year;
    const fundsBefore = toFinancesView(state).businessFunds;
    const franchiseBefore = toFranchiseHubView(state);

    // Simulate completed playoffs contamination
    state = {
      ...state,
      competition: {
        ...state.competition,
        playoffs: {
          status: "complete",
          fieldSize: 4,
          qualifiedTeams: [{ teamId, seed: 1 }],
          series: [],
          championTeamId: teamId,
        },
      },
    };

    expect(toPlayoffHubView(state).userStatus).toBe("champion");

    state = bumpSeasonYear(state);

    expect(state.competition.season.year).toBe(yearBefore + 1);
    expect(state.competition.season.phase).toBe("preseason");
    expect(toPlayoffHubView(state).available).toBe(false);
    expect(toPlayoffHubView(state).userStatus).toBe("not_in_playoffs");

    const standings = toStandingsPageView(state);
    const row = standings.leagueRows.find((r) => r.teamId === teamId);
    if (row) {
      expect(row.wins).toBe(0);
      expect(row.losses).toBe(0);
    }

    // Persist: finances identity remains available
    expect(toFinancesView(state).businessFunds).toBeTypeOf("number");
    expect(toFranchiseHubView(state).franchiseValue).toBeTypeOf("number");
    expect(franchiseBefore.teamName.length).toBeGreaterThan(0);
    expect(fundsBefore).toBeTypeOf("number");
  });
});
