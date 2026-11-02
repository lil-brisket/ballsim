import {
  PLAYER_POSITIONS,
  playsPosition,
  type Player,
  type PlayerPosition,
} from "@/domain/entities/player";
import type { LineupSlot } from "@/domain/entities/team-roster-management";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";

export type LineupAssignment = {
  /** One slot per filled position, in PG, SG, SF, PF, C order. */
  slots: LineupSlot[];
  /** Positions no available player could fill once the others were placed. */
  unfilled: PlayerPosition[];
};

/**
 * Places players into the five slots, each at his primary or secondary
 * position only. Returns a maximum assignment: when the players cannot cover
 * every slot (five guards, or the only center hurt), `unfilled` names the
 * positions left open and no off-position player is used to cover them.
 *
 * Deterministic. Each slot prefers players whose primary position it is, best
 * rating at the slot first, then players using their secondary, then id.
 * An earlier slot is never given up for a later one, except when that is the
 * only way to fill more slots.
 */
export function assignLineupSlots(
  players: readonly Player[],
): LineupAssignment {
  const candidatesBySlot = new Map<PlayerPosition, Player[]>();
  for (const slot of PLAYER_POSITIONS) {
    candidatesBySlot.set(
      slot,
      players
        .filter((player) => playsPosition(player, slot))
        .sort((a, b) => compareForSlot(a, b, slot)),
    );
  }

  const slotByPlayerId = new Map<string, PlayerPosition>();

  const place = (slot: PlayerPosition, visited: Set<string>): boolean => {
    for (const player of candidatesBySlot.get(slot) ?? []) {
      if (visited.has(player.id)) continue;
      visited.add(player.id);
      const current = slotByPlayerId.get(player.id);
      if (current === undefined || place(current, visited)) {
        slotByPlayerId.set(player.id, slot);
        return true;
      }
    }
    return false;
  };

  for (const slot of PLAYER_POSITIONS) {
    place(slot, new Set());
  }

  const playerBySlot = new Map<PlayerPosition, string>();
  for (const [playerId, slot] of slotByPlayerId) {
    playerBySlot.set(slot, playerId);
  }
  const slots: LineupSlot[] = [];
  const unfilled: PlayerPosition[] = [];
  for (const slot of PLAYER_POSITIONS) {
    const playerId = playerBySlot.get(slot);
    if (playerId === undefined) {
      unfilled.push(slot);
    } else {
      slots.push({ playerId: playerId as LineupSlot["playerId"], slot });
    }
  }
  return { slots, unfilled };
}

function compareForSlot(a: Player, b: Player, slot: PlayerPosition): number {
  const primaryA = a.position === slot ? 0 : 1;
  const primaryB = b.position === slot ? 0 : 1;
  if (primaryA !== primaryB) return primaryA - primaryB;
  const ratingA = calculatePlayerOverall(slot, a.attributes);
  const ratingB = calculatePlayerOverall(slot, b.attributes);
  if (ratingA !== ratingB) return ratingB - ratingA;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** True when the players can fill all five slots at natural positions. */
export function hasLegalLineup(players: readonly Player[]): boolean {
  return assignLineupSlots(players).unfilled.length === 0;
}

/** Steps on the PG-to-C ladder from the player's nearest natural position. */
export function positionDistance(
  player: Pick<Player, "position" | "secondaryPosition">,
  slot: PlayerPosition,
): number {
  const target = PLAYER_POSITIONS.indexOf(slot);
  const positions = player.secondaryPosition
    ? [player.position, player.secondaryPosition]
    : [player.position];
  return Math.min(
    ...positions.map((position) =>
      Math.abs(PLAYER_POSITIONS.indexOf(position) - target),
    ),
  );
}

/**
 * The position each player is playing. A legal lineup has everyone at his
 * primary or secondary position, one player per slot. When the players cannot
 * cover every slot, the left-over players take the open slots nearest their
 * own, and one with no open slot left keeps his primary. Stateless and
 * deterministic: depends only on who is on the floor, in the order given.
 */
export function playedPositions(
  players: readonly Player[],
): ReadonlyMap<string, PlayerPosition> {
  // Fast path (the usual lineup): everyone's primary position is different, so
  // each plays his primary and no assignment is needed.
  if (
    new Set(players.map((player) => player.position)).size === players.length
  ) {
    return new Map(players.map((player) => [player.id, player.position]));
  }
  const { slots } = assignLineupSlots(players);
  const played = new Map<string, PlayerPosition>();
  for (const slot of slots) {
    played.set(slot.playerId, slot.slot);
  }
  const open = PLAYER_POSITIONS.filter(
    (position) => !slots.some((slot) => slot.slot === position),
  );
  for (const player of players) {
    if (played.has(player.id)) continue;
    let best: PlayerPosition | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of open) {
      const distance = positionDistance(player, candidate);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }
    if (best === undefined) {
      played.set(player.id, player.position);
    } else {
      open.splice(open.indexOf(best), 1);
      played.set(player.id, best);
    }
  }
  return played;
}

/**
 * A starting five from players ordered best first: the best natural fit for
 * each position, then, only if some position has no one who plays it, the best
 * remaining player at the nearest position. Returned in PG to C order, with
 * fewer than `size` players only when the roster is that short.
 */
export function selectPositionalStarters(
  playersBestFirst: readonly Player[],
  size: number = PLAYER_POSITIONS.length,
): Player[] {
  const { slots } = assignLineupSlots(playersBestFirst);
  const byId = new Map(playersBestFirst.map((player) => [player.id, player]));
  const chosen = new Map<PlayerPosition, Player>();
  for (const slot of slots) {
    chosen.set(slot.slot, byId.get(slot.playerId)!);
  }
  const used = new Set<string>(slots.map((slot) => slot.playerId));
  for (const position of PLAYER_POSITIONS) {
    if (chosen.size >= size) break;
    if (chosen.has(position)) continue;
    let best: Player | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const player of playersBestFirst) {
      if (used.has(player.id)) continue;
      const distance = positionDistance(player, position);
      if (distance < bestDistance) {
        best = player;
        bestDistance = distance;
      }
    }
    if (best === undefined) break;
    used.add(best.id);
    chosen.set(position, best);
  }
  return PLAYER_POSITIONS.flatMap((position) => {
    const player = chosen.get(position);
    return player === undefined ? [] : [player];
  });
}
