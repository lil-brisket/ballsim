import type { DomainEvent } from "@/domain/events";
import type { GameState } from "@/state/game-state";

/**
 * Uniform result contract for simulation systems.
 * Prefer returning a new state (immutable / controlled transition).
 */
export type SystemResult = {
  state: GameState;
  events: DomainEvent[];
};

export function systemResult(
  state: GameState,
  events: DomainEvent[] = [],
): SystemResult {
  return { state, events };
}
