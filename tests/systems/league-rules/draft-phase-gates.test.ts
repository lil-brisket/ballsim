import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { draftClassIdFor } from "@/domain/entities/draft";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import {
  canAdvanceFromPhase,
  canEnterPhase,
} from "@/systems/league-rules/phase-prerequisites";
import { createDraft } from "@/systems/draft/draft-creation";
import { bootstrapWorld } from "@/systems/world-pipeline";

/** This season's draft class is unfinished; last season's draft is complete. */
function secondSeasonMidDraft(): GameState {
  const initial = createInitialGameState({
    saveId: "draft_gates",
    rngSeed: 9,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(initial.meta.rngState);
  let state = bootstrapWorld(initial, rng).state;
  state = createDraft(state, rng).state;
  const year = state.competition.season.year;
  const current = Object.values(state.world.drafts).find(
    (draft) => draft.seasonYear === year + 1,
  )!;
  expect(current.status).not.toBe("complete");
  const lastYearId = draftClassIdFor(year);
  return {
    ...state,
    world: {
      ...state.world,
      drafts: {
        ...state.world.drafts,
        [lastYearId]: {
          ...current,
          id: lastYearId,
          seasonYear: year,
          status: "complete",
        },
      },
    },
  };
}

function completeCurrentDraft(state: GameState): GameState {
  const year = state.competition.season.year;
  const drafts = Object.fromEntries(
    Object.entries(state.world.drafts).map(([id, draft]) => [
      id,
      draft.seasonYear === year + 1
        ? { ...draft, status: "complete" as const }
        : draft,
    ]),
  );
  return { ...state, world: { ...state.world, drafts } };
}

describe("draft phase gates", () => {
  it("keeps the draft phase open while this season's draft is unfinished", () => {
    const state = secondSeasonMidDraft();
    expect(canAdvanceFromPhase(state, "offseason.draft").allowed).toBe(false);
    expect(
      canEnterPhase(state, "offseason.free_agency").violations.map(
        (violation) => violation.code,
      ),
    ).toContain("DRAFT_NOT_COMPLETE");
  });

  it("opens once this season's draft completes", () => {
    const state = completeCurrentDraft(secondSeasonMidDraft());
    expect(canAdvanceFromPhase(state, "offseason.draft").allowed).toBe(true);
    expect(
      canEnterPhase(state, "offseason.free_agency").violations.map(
        (violation) => violation.code,
      ),
    ).not.toContain("DRAFT_NOT_COMPLETE");
  });
});
