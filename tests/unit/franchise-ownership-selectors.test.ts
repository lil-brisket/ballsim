import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { toFranchiseOwnershipView } from "@/state/franchise-ownership-selectors";
import { getActiveOwnedFranchise } from "@/state/owner-context";
import type { GameState, OwnedFranchiseState } from "@/state/game-state";
import { asOwnerObjectiveId } from "@/domain/ids";
import { testOwnerObjective } from "../helpers/owner-objective";

function bootstrapped(): GameState {
  const state = createTestGameState({ saveId: "save_ownership" });
  const rng = createSeededRng(state.meta.rngState);
  return bootstrapWorld(state, rng).state;
}

function withFranchise(
  state: GameState,
  update: (franchise: OwnedFranchiseState) => Partial<OwnedFranchiseState>,
): GameState {
  const teamId = state.user.activeOwnerTeamId;
  const franchise = getActiveOwnedFranchise(state);
  return {
    ...state,
    user: {
      ...state.user,
      ownedFranchises: {
        ...state.user.ownedFranchises,
        [teamId]: { ...franchise, ...update(franchise) },
      },
    },
  };
}

describe("toFranchiseOwnershipView", () => {
  it("lists season moods newest first", () => {
    const state = withFranchise(bootstrapped(), (franchise) => ({
      ownershipConfidence: {
        ...franchise.ownershipConfidence,
        seasonNotes: [
          { seasonYear: 2026, mood: "concerned", mandateSummary: "Win now" },
          { seasonYear: 2027, mood: "confident", mandateSummary: "Win now" },
        ],
      },
    }));

    const view = toFranchiseOwnershipView(state);
    expect(view.seasonMoods.map((row) => row.seasonYear)).toEqual([2027, 2026]);
    expect(view.seasonMoods[0]?.moodLabel).toBe("Confident");
  });

  it("groups only resolved objectives by season and totals them", () => {
    const base = bootstrapped();
    const objective = (
      id: string,
      seasonYear: number,
      status: "active" | "completed" | "failed",
    ) =>
      testOwnerObjective({
        id: asOwnerObjectiveId(id),
        type: "make_playoffs",
        description: `Objective ${id}`,
        status,
        seasonYear,
      });
    const state = withFranchise(base, () => ({
      objectives: [
        objective("obj_a", 2026, "completed"),
        objective("obj_b", 2026, "failed"),
        objective("obj_c", 2027, "completed"),
        objective("obj_d", 2027, "active"),
      ],
    }));

    const view = toFranchiseOwnershipView(state);
    expect(
      view.objectiveSeasons.map((s) => [s.seasonYear, s.completed, s.failed]),
    ).toEqual([
      [2027, 1, 0],
      [2026, 1, 1],
    ]);
    expect(view.totals).toEqual({ completed: 2, failed: 1 });
  });
});
