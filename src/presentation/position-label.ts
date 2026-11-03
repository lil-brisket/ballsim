import type { PlayerPosition } from "@/domain/entities/player";

/**
 * How a player's positions read in the UI: "PG" for most players, "PG/SG"
 * when he also has a secondary position. Primary first.
 */
export function formatPositionLabel(
  position: PlayerPosition | string,
  secondaryPosition?: PlayerPosition | string | null,
): string {
  return secondaryPosition ? `${position}/${secondaryPosition}` : position;
}
