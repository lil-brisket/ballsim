import {
  isValidPortraitAssignment,
  type PlayerPortraitAssignment,
} from "@/domain/entities/player-portrait";
import type { GameState } from "@/state/game-state";
import { isShippedPortraitLibraryId } from "@/systems/portraits/portrait-library";

/**
 * Persisted portrait for a player or draft prospect id; null when missing or
 * invalid (UI renders the initials fallback). A library id that is not in the
 * shipped manifest is dropped, so the UI falls back to the SVG face instead of
 * a broken image until the next save write re-resolves it. Read-only — never
 * assigns.
 */
export function selectPlayerPortrait(
  state: GameState,
  playerId: string,
): PlayerPortraitAssignment | null {
  const entry = state.world.playerPortraits?.[playerId];
  if (!isValidPortraitAssignment(entry)) return null;
  if (
    entry.libraryId !== undefined &&
    !isShippedPortraitLibraryId(entry.libraryId)
  ) {
    const { libraryId: _stale, ...face } = entry;
    void _stale;
    return face;
  }
  return entry;
}
