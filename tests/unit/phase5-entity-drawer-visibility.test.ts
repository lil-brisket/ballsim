/**
 * Entity drawer information-visibility expectations for Phase 5 contexts.
 * Draft never exposes trueOverall; Free Agency intentionally exposes true OVR.
 */

import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import {
  draftHubExposesTrueOverall,
  toDraftHubView,
} from "@/state/draft-hub-selectors";
import { toFreeAgencyHubView } from "@/state/free-agency-hub-selectors";
import type { GameState } from "@/state/game-state";

describe("phase5 entity drawer visibility contracts", () => {
  it("draft hub never leaks true overall for drawer/table parity", () => {
    let state = createTestGameState({ saveId: "drawer_draft_vis" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: {
          ...state.competition.season,
          phase: "offseason",
          offseasonStage: "draft",
        },
      },
    } satisfies GameState;

    const hub = toDraftHubView(state);
    expect(draftHubExposesTrueOverall(hub)).toBe(false);
  });

  it("free agency hub documents intentional true-OVR exposure for drawer parity", () => {
    let state = createTestGameState({ saveId: "drawer_fa_vis" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const hub = toFreeAgencyHubView(state);
    expect(hub.exposesTrueOverall).toBe(true);
    for (const agent of hub.market) {
      expect(typeof agent.overall).toBe("number");
    }
  });
});
