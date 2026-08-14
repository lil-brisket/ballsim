import type { PlayerPosition } from "@/domain/entities/player";

/** Default roster size used by roster and league generation. */
export const DEFAULT_ROSTER_SIZE = 10;

const ROSTER_POSITION_CYCLE: readonly PlayerPosition[] = [
  "PG",
  "SG",
  "SF",
  "PF",
  "C",
];

/**
 * Maps a zero-based roster slot to a position.
 * Cycles PG → SG → SF → PF → C.
 */
export function rosterPositionForSlot(slot: number): PlayerPosition {
  if (!Number.isInteger(slot) || slot < 0) {
    throw new Error("Roster slot must be a non-negative integer.");
  }
  return ROSTER_POSITION_CYCLE[slot % ROSTER_POSITION_CYCLE.length]!;
}
