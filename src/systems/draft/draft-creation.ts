import {
  draftClassIdFor,
  type DraftClass,
} from "@/domain/entities/draft";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  countDraftPicksForYear,
  draftYearForSeason,
  generateDraftOrder,
} from "@/systems/draft/draft-order";
import { generateDraftProspects } from "@/systems/draft/draft-prospects";
import { generateDraftScouting } from "@/systems/draft/draft-scouting";

/**
 * Atomically creates a full DraftClass (prospects + order + scouting).
 * Inserts into world.drafts only after the complete aggregate is built.
 * Status is not_started. Callers must persist rng.getState() on success.
 */
export function createDraft(state: GameState, rng: Rng): SystemResult {
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);

  if (state.world.drafts[draftClassId] !== undefined) {
    throw new Error(
      `Draft class "${draftClassId}" already exists.`,
    );
  }
  if (Object.keys(state.world.teams).length < 1) {
    throw new Error("Cannot create draft: no teams in world.");
  }
  if (countDraftPicksForYear(state, draftYear) < 1) {
    throw new Error(
      `Cannot create draft: no draft picks for seasonYear ${draftYear}.`,
    );
  }

  const prospects = generateDraftProspects(
    state,
    rng,
    draftClassId,
    draftYear,
  );
  const order = generateDraftOrder(state, draftYear);
  const scouting = generateDraftScouting(state, rng, prospects);

  const draftClass: DraftClass = {
    id: draftClassId,
    seasonYear: draftYear,
    status: "not_started",
    prospects,
    order,
    scouting,
    selections: [],
  };

  return systemResult({
    ...state,
    world: {
      ...state.world,
      drafts: {
        ...state.world.drafts,
        [draftClassId]: draftClass,
      },
    },
  });
}
