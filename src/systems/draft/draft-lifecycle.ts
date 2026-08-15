import type { DraftClass } from "@/domain/entities/draft";
import type { DraftClassId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

/**
 * not_started → active. Rejects other transitions.
 */
export function activateDraft(
  state: GameState,
  draftClassId: DraftClassId,
): SystemResult {
  const draft = requireDraft(state, draftClassId);
  if (draft.status !== "not_started") {
    throw new Error(
      `Cannot activate draft "${draftClassId}": status is "${draft.status}".`,
    );
  }
  return replaceDraft(state, {
    ...draft,
    status: "active",
  });
}

/**
 * active → complete. Does not create players for remaining eligible prospects.
 */
export function completeDraft(
  state: GameState,
  draftClassId: DraftClassId,
): SystemResult {
  const draft = requireDraft(state, draftClassId);
  if (draft.status !== "active") {
    throw new Error(
      `Cannot complete draft "${draftClassId}": status is "${draft.status}".`,
    );
  }
  return replaceDraft(state, {
    ...draft,
    status: "complete",
  });
}

function requireDraft(
  state: GameState,
  draftClassId: DraftClassId,
): DraftClass {
  const draft = state.world.drafts[draftClassId];
  if (draft === undefined) {
    throw new Error(`Draft "${draftClassId}" does not exist.`);
  }
  return draft;
}

function replaceDraft(state: GameState, draft: DraftClass): SystemResult {
  return systemResult({
    ...state,
    world: {
      ...state.world,
      drafts: {
        ...state.world.drafts,
        [draft.id]: draft,
      },
    },
  });
}
