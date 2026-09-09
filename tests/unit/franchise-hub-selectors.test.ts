import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import {
  sortFranchiseObjectives,
  toFranchiseHubView,
} from "@/state/franchise-hub-selectors";
import type { ObjectiveView } from "@/state/selectors";
import { explainFranchiseValue } from "@/state/franchise-value";
import { getActiveOwnerTeamId } from "@/state/owner-context";

describe("franchise-hub-selectors", () => {
  it("builds high-level hub matching franchise value", () => {
    let state = createTestGameState({ saveId: "franchise_hub_test" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const hub = toFranchiseHubView(state);
    const teamId = getActiveOwnerTeamId(state);
    const value = explainFranchiseValue(state, teamId);

    expect(hub.franchiseValue).toBe(value.total);
    expect(hub.links.length).toBeGreaterThanOrEqual(4);
    expect(hub.snapshot).toHaveProperty("fanSentiment");
    expect(hub.history).toBeDefined();
  });

  it("sorts active objectives first", () => {
    const objectives: ObjectiveView[] = [
      {
        id: "b",
        type: "make_playoffs",
        description: "Completed",
        status: "completed",
        seasonYear: 2026,
        category: "on_court",
        lifecycle: "season",
        role: "primary",
        target: 1,
        progress: 1,
        horizonYears: 1,
        baseline: null,
        consequenceApplied: false,
      },
      {
        id: "a",
        type: "make_playoffs",
        description: "Active",
        status: "active",
        seasonYear: 2026,
        category: "on_court",
        lifecycle: "season",
        role: "primary",
        target: 1,
        progress: 0,
        horizonYears: 1,
        baseline: null,
        consequenceApplied: false,
      },
    ];
    expect(sortFranchiseObjectives(objectives)[0]!.id).toBe("a");
  });
});
