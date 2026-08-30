/**
 * Modular hooks for combine / medical / workout evaluation events.
 * Stubs for future expansion — do not change true ratings directly.
 */

import type { DraftClass } from "@/domain/entities/draft";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

export type DraftEvaluationEventType =
  | "combine"
  | "medical"
  | "team_workout"
  | "private_workout"
  | "interview";

export type DraftEvaluationEvent = {
  type: DraftEvaluationEventType;
  prospectPlayerId: PlayerId;
  teamId?: TeamId;
  occurredOn: string;
  notes?: string;
};

type EvaluationHandler = (
  state: GameState,
  draft: DraftClass,
  event: DraftEvaluationEvent,
) => GameState;

const handlers: Partial<Record<DraftEvaluationEventType, EvaluationHandler>> =
  {};

export function registerDraftEvaluationHandler(
  type: DraftEvaluationEventType,
  handler: EvaluationHandler,
): void {
  handlers[type] = handler;
}

/**
 * Apply a registered evaluation event. No-op if no handler registered.
 * Events reveal information via scouting updates — never silently mutate truth.
 */
export function applyDraftEvaluationEvent(
  state: GameState,
  draft: DraftClass,
  event: DraftEvaluationEvent,
): GameState {
  const handler = handlers[event.type];
  if (!handler) return state;
  return handler(state, draft, event);
}
