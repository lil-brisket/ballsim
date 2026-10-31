import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { asPlayerId } from "@/domain/ids";
import { toPlayerDrawerView } from "@/state/entity-drawer-selectors";
import {
  FREE_AGENT_SHEET_LIMIT,
  toRosterPageView,
} from "@/state/roster-page-selectors";
import { toSheetPlayerView } from "@/state/roster-sheet-view";
import { toFreeAgentViews } from "@/state/selectors";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

function league() {
  const base = createTestGameState({ saveId: "sheet_view_test" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

describe("toSheetPlayerView", () => {
  it("matches the player drawer for a free agent", () => {
    const state = league();
    const freeAgent = toFreeAgentViews(state)[0]!;
    const id = asPlayerId(freeAgent.playerId);
    const row = toSheetPlayerView(state, id)!;
    const drawer = toPlayerDrawerView(state, id, "sheet_view_test")!;

    expect(row.attributes).toEqual(drawer.ratings.attributes);
    expect(row.potential).toBe(drawer.identity.potential);
    expect(row.overall).toBe(drawer.identity.overall);
    expect(row.heightInches).toBe(drawer.identity.heightInches);
    expect(row.weightPounds).toBe(drawer.identity.weightPounds);
    expect(row.archetypeLabel).toBe(drawer.identity.archetypeLabel);
    expect(row.jerseyNumber).toBe(drawer.identity.jerseyNumber);
    expect(row.performance).toEqual(drawer.performance);
    // No games yet: dashes (null), never zeros.
    expect(row.performance.games).toBe(0);
    expect(row.performance.ppg).toBeNull();
    expect(row.contractSalary).toBeNull();
    expect(row.contractYearsRemaining).toBeNull();
    expect(row.rotationRole).toBeUndefined();
    expect(row.canPlay).toBe(true);
    expect(row.availabilityLabel).toBe("Available");
  });

  it("gives a rostered player a salary and years left", () => {
    const state = league();
    const rosterId =
      state.world.teams[state.user.activeOwnerTeamId]!.roster[0]!;
    const row = toSheetPlayerView(state, rosterId)!;
    expect(row.contractSalary).not.toBeNull();
    expect(row.contractYearsRemaining).toBeGreaterThan(0);
  });

  it("returns null for an unknown player and applies overrides", () => {
    const state = league();
    expect(toSheetPlayerView(state, asPlayerId("nobody"))).toBeNull();
    const id = asPlayerId(toFreeAgentViews(state)[0]!.playerId);
    expect(
      toSheetPlayerView(state, id, { rotationRole: "bench" })!.rotationRole,
    ).toBe("bench");
  });
});

describe("RosterPageView.freeAgents", () => {
  it("carries the top 40 by overall and the full count", () => {
    const state = league();
    const all = toFreeAgentViews(state);
    expect(all.length).toBeGreaterThan(0);
    const view = toRosterPageView(state);
    expect(view.freeAgentCount).toBe(all.length);
    expect(view.freeAgents).toHaveLength(
      Math.min(FREE_AGENT_SHEET_LIMIT, all.length),
    );
    expect(view.freeAgents.map((row) => row.playerId)).toEqual(
      all.slice(0, FREE_AGENT_SHEET_LIMIT).map((row) => row.playerId),
    );
    const overalls = view.freeAgents.map((row) => row.overall);
    expect(overalls).toEqual([...overalls].sort((a, b) => b - a));
  });
});
