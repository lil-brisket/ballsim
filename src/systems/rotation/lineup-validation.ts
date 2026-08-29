/**
 * Soft lineup viability scoring — not rigid PG/SG/SF/PF/C requirements.
 */

import type { Player, PlayerPosition } from "@/domain/entities/player";
import type { RotationEntry } from "@/domain/entities/team-roster-management";
import type { PlayerId } from "@/domain/ids";

export type LineupValidationResult = {
  valid: boolean;
  sizeOk: boolean;
  allEligible: boolean;
  viabilityScore: number;
  issues: string[];
};

export function preferredPositionsFor(
  entry: RotationEntry | undefined,
  player: Player,
): PlayerPosition[] {
  if (entry != null && entry.preferredPositions.length > 0) {
    return entry.preferredPositions;
  }
  return [player.position];
}

export function allPositionsFor(
  entry: RotationEntry | undefined,
  player: Player,
): PlayerPosition[] {
  const preferred = preferredPositionsFor(entry, player);
  const secondary = entry?.secondaryPositions ?? [];
  return [...new Set([...preferred, ...secondary, player.position])];
}

/**
 * Soft score: higher is better. Rewards position diversity without requiring
 * one of each classic position.
 */
export function scoreLineupViability(
  onCourt: readonly Player[],
  rotationByPlayerId: ReadonlyMap<string, RotationEntry>,
): number {
  if (onCourt.length !== 5) {
    return 0;
  }
  const covered = new Set<PlayerPosition>();
  let flexibility = 0;
  for (const player of onCourt) {
    const entry = rotationByPlayerId.get(player.id);
    const positions = allPositionsFor(entry, player);
    for (const position of positions) {
      covered.add(position);
    }
    flexibility += positions.length;
  }
  // Prefer covering at least 3 distinct position buckets and having a big/guard mix
  const diversity = covered.size * 2;
  const hasGuard = [...covered].some(
    (p) => p === "PG" || p === "SG",
  );
  const hasBig = [...covered].some((p) => p === "PF" || p === "C");
  const mixBonus = (hasGuard ? 3 : 0) + (hasBig ? 3 : 0);
  return diversity + flexibility * 0.25 + mixBonus;
}

export function validateLineup(input: {
  onCourt: readonly Player[];
  unavailableIds: ReadonlySet<string>;
  rotationByPlayerId: ReadonlyMap<string, RotationEntry>;
}): LineupValidationResult {
  const issues: string[] = [];
  const sizeOk = input.onCourt.length === 5;
  if (!sizeOk) {
    issues.push(`Lineup must have exactly 5 players (have ${input.onCourt.length}).`);
  }

  let allEligible = true;
  const seen = new Set<string>();
  for (const player of input.onCourt) {
    if (seen.has(player.id)) {
      allEligible = false;
      issues.push(`Duplicate player ${player.id} on court.`);
    }
    seen.add(player.id);
    if (input.unavailableIds.has(player.id)) {
      allEligible = false;
      issues.push(`Unavailable player ${player.id} is on court.`);
    }
  }

  const viabilityScore = scoreLineupViability(
    input.onCourt,
    input.rotationByPlayerId,
  );

  return {
    valid: sizeOk && allEligible,
    sizeOk,
    allEligible,
    viabilityScore,
    issues,
  };
}

export function buildRotationMap(
  rotation: readonly RotationEntry[],
): Map<string, RotationEntry> {
  const map = new Map<string, RotationEntry>();
  for (const entry of rotation) {
    map.set(entry.playerId, entry);
  }
  return map;
}

export function playerCanCoverSlot(
  player: Player,
  slot: PlayerPosition,
  entry: RotationEntry | undefined,
): boolean {
  return allPositionsFor(entry, player).includes(slot);
}
