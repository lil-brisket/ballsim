import type { PendingDraftClassDecision } from "@/domain/entities/draft-class-decision";
import type { GameState } from "@/state/game-state";

export function draftClassDecisionKey(draftYear: number): string {
  return String(draftYear);
}

export function getDraftClassDecision(
  state: GameState,
  draftYear: number,
): PendingDraftClassDecision | undefined {
  return state.user.pendingDraftClassDecisions[draftClassDecisionKey(draftYear)];
}

export function isDraftClassDecisionResolved(
  state: GameState,
  draftYear: number,
): boolean {
  return getDraftClassDecision(state, draftYear)?.resolved === true;
}

export function ensureDraftClassDecision(
  state: GameState,
  draftYear: number,
): GameState {
  const key = draftClassDecisionKey(draftYear);
  if (state.user.pendingDraftClassDecisions[key] !== undefined) {
    return state;
  }
  return {
    ...state,
    user: {
      ...state.user,
      pendingDraftClassDecisions: {
        ...state.user.pendingDraftClassDecisions,
        [key]: { draftYear, resolved: false },
      },
    },
  };
}

export function withDraftClassDecision(
  state: GameState,
  decision: PendingDraftClassDecision,
): GameState {
  return {
    ...state,
    user: {
      ...state.user,
      pendingDraftClassDecisions: {
        ...state.user.pendingDraftClassDecisions,
        [draftClassDecisionKey(decision.draftYear)]: decision,
      },
    },
  };
}
