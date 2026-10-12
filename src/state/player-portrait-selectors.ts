import {
  isValidPortraitAssignment,
  type PlayerPortraitAssignment,
} from "@/domain/entities/player-portrait";
import type { GameState } from "@/state/game-state";

/**
 * Persisted portrait for a player or draft prospect id; null when missing or
 * invalid (UI renders the initials fallback). Read-only — never assigns.
 */
export function selectPlayerPortrait(
  state: GameState,
  playerId: string,
): PlayerPortraitAssignment | null {
  const entry = state.world.playerPortraits?.[playerId];
  return isValidPortraitAssignment(entry) ? entry : null;
}
