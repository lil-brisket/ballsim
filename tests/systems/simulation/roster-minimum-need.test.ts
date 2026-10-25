import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { detectManagementNeeds } from "@/systems/simulation/management-needs";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../../factories/game-state";

/** Rosters run from 12 to 15 players; only a roster under 12 is short. */
describe("roster minimum need", () => {
  function withUserRosterSize(size: number): GameState {
    let state = createTestGameState({ saveId: "roster_minimum_need" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamId = state.user.activeOwnerTeamId;
    const team = state.world.teams[teamId]!;
    return {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [teamId]: { ...team, roster: team.roster.slice(0, size) },
        },
      },
    };
  }

  const belowMinimum = (state: GameState) =>
    detectManagementNeeds(state).some((need) => need.id === "roster_below_min");

  it("is the league rule: 12 to 15 players", () => {
    expect(TRADE_ROSTER_RULES.minRosterSize).toBe(12);
    expect(TRADE_ROSTER_RULES.maxRosterSize).toBe(15);
  });

  it("does not flag a roster between the minimum and the maximum", () => {
    expect(belowMinimum(withUserRosterSize(12))).toBe(false);
    expect(belowMinimum(withUserRosterSize(14))).toBe(false);
  });

  it("flags a roster under the minimum", () => {
    expect(belowMinimum(withUserRosterSize(11))).toBe(true);
  });
});
