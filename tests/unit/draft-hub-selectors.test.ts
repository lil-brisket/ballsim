import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import {
  draftHubExposesTrueOverall,
  toDraftHubView,
} from "@/state/draft-hub-selectors";
import type { GameState } from "@/state/game-state";

function withOffseasonStage(
  state: GameState,
  stage: GameState["competition"]["season"]["offseasonStage"],
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        phase: "offseason",
        offseasonStage: stage,
      },
    },
  };
}

describe("draft-hub-selectors", () => {
  it("shows inactive state outside draft stage", () => {
    let state = createTestGameState({ saveId: "draft_hub_inactive" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withOffseasonStage(state, "free_agency");

    const hub = toDraftHubView(state);
    expect(hub.active).toBe(false);
    expect(hub.inactiveReason).toBeTruthy();
    expect(hub.board).toBeNull();
  });

  it("never exposes true overall on prospect rows", () => {
    let state = createTestGameState({ saveId: "draft_hub_visibility" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withOffseasonStage(state, "draft");

    const hub = toDraftHubView(state);
    expect(draftHubExposesTrueOverall(hub)).toBe(false);
    for (const prospect of hub.prospects) {
      expect(prospect.trueOverall).toBeNull();
      expect(prospect).not.toHaveProperty("overall");
      expect(prospect).not.toHaveProperty("potentialOverall");
    }
  });

  it("orders picks by overall pick number when board is active", () => {
    let state = createTestGameState({ saveId: "draft_hub_picks" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = withOffseasonStage(state, "draft");

    const hub = toDraftHubView(state);
    if (hub.picks.length > 1) {
      for (let i = 1; i < hub.picks.length; i += 1) {
        expect(hub.picks[i]!.overallPick).toBeGreaterThanOrEqual(
          hub.picks[i - 1]!.overallPick,
        );
      }
    }
  });
});
