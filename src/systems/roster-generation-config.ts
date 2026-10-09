import type { PlayerPosition } from "@/domain/entities/player";
import type { QualityBand } from "@/systems/player-generation-config";

/** Default roster size used by roster and league generation. */
export const DEFAULT_ROSTER_SIZE = 15;

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

/**
 * Opening-day / fill quality by zero-based roster slot.
 * 0–4 starters, 5–9 rotation, 10+ bench. Pyramid density still applies inside
 * the band.
 */
export const ROSTER_QUALITY_BY_SLOT: readonly {
  maxSlot: number;
  qualityMin: number;
  qualityMax: number;
}[] = [
  { maxSlot: 4, qualityMin: 64, qualityMax: 85 },
  { maxSlot: 9, qualityMin: 52, qualityMax: 72 },
  { maxSlot: 999, qualityMin: 40, qualityMax: 60 },
];

export function rosterQualityBandForSlot(slot: number): QualityBand {
  if (!Number.isInteger(slot) || slot < 0) {
    throw new Error("Roster slot must be a non-negative integer.");
  }
  const band =
    ROSTER_QUALITY_BY_SLOT.find((entry) => slot <= entry.maxSlot) ??
    ROSTER_QUALITY_BY_SLOT[ROSTER_QUALITY_BY_SLOT.length - 1]!;
  return { min: band.qualityMin, max: band.qualityMax };
}
