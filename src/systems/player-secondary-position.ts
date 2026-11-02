import {
  createPlayer,
  PLAYER_POSITIONS,
  type Player,
  type PlayerPosition,
} from "@/domain/entities/player";
import { ARCHETYPE_COMPATIBLE_POSITIONS } from "@/domain/entities/player-archetype";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { POSITION_BODY_RANGES } from "@/systems/player-generation-config";

/**
 * Typical overall change when a generated player of the row position is rated
 * at the column position (median over generated players). Position formulas
 * are not equally generous, so a raw "as good at C as at PF" test would hand
 * out PF/C freely and C/PF almost never. Comparing against this baseline asks
 * whether a player is better than usual at the other position.
 *
 * A test recomputes the medians, so a change to the overall formulas or to
 * player generation shows up there.
 */
export const PAIR_OVERALL_BASELINE: Readonly<
  Record<PlayerPosition, Readonly<Record<PlayerPosition, number>>>
> = {
  PG: { PG: 0, SG: -1, SF: -4, PF: -7, C: -10 },
  SG: { PG: -1, SG: 0, SF: -3, PF: -6, C: -9 },
  SF: { PG: 0, SG: 1, SF: 0, PF: -1, C: -1 },
  PF: { PG: -8, SG: -7, SF: -4, PF: 0, C: 2 },
  C: { PG: -12, SG: -11, SF: -8, PF: -3, C: 0 },
};

/**
 * A player has a secondary position when another position:
 *  - suits his archetype (ARCHETYPE_COMPATIBLE_POSITIONS), so a Floor General
 *    never gets one,
 *  - fits his height and weight, and
 *  - rates at least `minOverallEdge` above the typical gap to his primary.
 * No archetype spans PG and C, so that pairing is only ever authored.
 * Tuned so about 15% of generated players qualify, spread across positions.
 * A secondary is never lost, so ratings that merely wobble past the line
 * would ratchet the league share upward; gaining one later, in yearly
 * development, therefore asks for a bigger edge than getting one at creation.
 * No RNG.
 */
export const SECONDARY_POSITION_CONFIG = {
  minOverallEdge: 1,
  gainOverallEdge: 2,
} as const;

type SecondaryPositionSubject = Pick<
  Player,
  "position" | "archetype" | "heightInches" | "weightPounds" | "attributes"
>;

function fitsBody(
  subject: SecondaryPositionSubject,
  position: PlayerPosition,
): boolean {
  const range = POSITION_BODY_RANGES[position];
  return (
    subject.heightInches >= range.minHeightInches &&
    subject.heightInches <= range.maxHeightInches &&
    subject.weightPounds >= range.minWeightPounds &&
    subject.weightPounds <= range.maxWeightPounds
  );
}

/**
 * The secondary position this player's archetype, body and ratings support,
 * or undefined. With several candidates the biggest edge wins, then the
 * nearer position, then lineup order, so the answer is deterministic.
 */
export function secondaryPositionFor(
  subject: SecondaryPositionSubject,
  minOverallEdge: number = SECONDARY_POSITION_CONFIG.minOverallEdge,
): PlayerPosition | undefined {
  const primaryIndex = PLAYER_POSITIONS.indexOf(subject.position);
  const primaryOverall = calculatePlayerOverall(
    subject.position,
    subject.attributes,
  );
  let best: PlayerPosition | undefined;
  let bestEdge = Number.NEGATIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of PLAYER_POSITIONS) {
    if (candidate === subject.position) continue;
    if (
      !ARCHETYPE_COMPATIBLE_POSITIONS[subject.archetype].includes(candidate)
    ) {
      continue;
    }
    if (!fitsBody(subject, candidate)) continue;
    const edge =
      calculatePlayerOverall(candidate, subject.attributes) -
      primaryOverall -
      PAIR_OVERALL_BASELINE[subject.position][candidate];
    if (edge < minOverallEdge) continue;
    const distance = Math.abs(
      PLAYER_POSITIONS.indexOf(candidate) - primaryIndex,
    );
    if (edge > bestEdge || (edge === bestEdge && distance < bestDistance)) {
      best = candidate;
      bestEdge = edge;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Gives the player a secondary position when he qualifies. A secondary is
 * never lost, so a player who already has one is returned unchanged.
 */
export function gainSecondaryPosition(player: Player): Player {
  if (player.secondaryPosition !== undefined) {
    return player;
  }
  const secondaryPosition = secondaryPositionFor(
    player,
    SECONDARY_POSITION_CONFIG.gainOverallEdge,
  );
  if (secondaryPosition === undefined) {
    return player;
  }
  return createPlayer({ ...player, secondaryPosition });
}
