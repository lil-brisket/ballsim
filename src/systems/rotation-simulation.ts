/**
 * Position-aware rotation substitutions driven by planned minutes.
 * Never substitutes purely by minutes deficit without position compatibility.
 */

import type { Player, PlayerPosition } from "@/domain/entities/player";
import type { TeamRosterManagement } from "@/domain/entities/team-roster-management";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isPlayerAvailable } from "@/systems/player-availability";
import { PLAYER_POSITIONS } from "@/domain/entities/player";

export type RotationSimSide = {
  teamId: TeamId;
  onCourt: Player[];
  /** Slot order matching onCourt (PG..C when possible). */
  slots: PlayerPosition[];
};

export type SubstitutionResult = {
  onCourt: Player[];
  slots: PlayerPosition[];
  substituted: boolean;
  playerOutId?: PlayerId;
  playerInId?: PlayerId;
  emergencyMismatch?: boolean;
};

function plannedMinutesFor(
  management: TeamRosterManagement,
  playerId: PlayerId,
): number {
  const entry = management.rotation.find((row) => row.playerId === playerId);
  return entry?.plannedMinutes ?? 0;
}

function eligiblePositionsFor(
  management: TeamRosterManagement,
  player: Player,
): PlayerPosition[] {
  const entry = management.rotation.find((row) => row.playerId === player.id);
  if (entry != null && entry.eligiblePositions.length > 0) {
    return entry.eligiblePositions;
  }
  return [player.position];
}

function rotationDepthLimit(style: TeamRosterManagement["rotationStyle"]): number {
  if (style === "tight") {
    return 7;
  }
  if (style === "deep") {
    return 10;
  }
  return 8;
}

/**
 * At period breaks / checkpoints: replace the most over-pace on-court player
 * with the best position-compatible bench player under their planned target.
 */
export function applyRotationSubstitutions(input: {
  state: GameState;
  side: RotationSimSide;
  secondsOnCourt: ReadonlyMap<string, number>;
  elapsedGameSeconds: number;
}): SubstitutionResult {
  const { state, side, secondsOnCourt, elapsedGameSeconds } = input;
  const team = state.world.teams[side.teamId];
  if (team == null || side.onCourt.length === 0) {
    return {
      onCourt: side.onCourt,
      slots: side.slots,
      substituted: false,
    };
  }

  const management = team.rosterManagement;
  const depthLimit = rotationDepthLimit(management.rotationStyle);
  const activeIds = new Set(
    management.rotation
      .filter((entry) => entry.plannedMinutes > 0)
      .sort((a, b) => b.plannedMinutes - a.plannedMinutes)
      .slice(0, depthLimit)
      .map((entry) => entry.playerId),
  );

  const gameMinutesElapsed = elapsedGameSeconds / 60;
  const regulationMinutes = 48;
  const pace = Math.max(gameMinutesElapsed / regulationMinutes, 0.01);

  let worstIndex = -1;
  let worstOver = 0;
  for (let index = 0; index < side.onCourt.length; index += 1) {
    const player = side.onCourt[index]!;
    const planned = plannedMinutesFor(management, player.id);
    if (planned <= 0) {
      continue;
    }
    const actual = (secondsOnCourt.get(player.id) ?? 0) / 60;
    const expected = planned * pace;
    const over = actual - expected;
    if (over > worstOver && over > 1.5) {
      worstOver = over;
      worstIndex = index;
    }
  }

  if (worstIndex < 0) {
    return {
      onCourt: side.onCourt,
      slots: side.slots,
      substituted: false,
    };
  }

  const playerOut = side.onCourt[worstIndex]!;
  const slot =
    side.slots[worstIndex] ??
    playerOut.position ??
    PLAYER_POSITIONS[worstIndex] ??
    "SF";

  const onCourtIds = new Set(side.onCourt.map((player) => player.id));
  const benchCandidates = management.bench
    .map((playerId) => state.world.players[playerId])
    .filter((player): player is Player => player != null)
    .filter((player) => !onCourtIds.has(player.id))
    .filter((player) => isPlayerAvailable(state, player.id, side.teamId))
    .filter((player) => activeIds.has(player.id) || activeIds.size === 0);

  const compatible = benchCandidates.filter((player) =>
    eligiblePositionsFor(management, player).includes(slot),
  );

  const pool = compatible.length > 0 ? compatible : benchCandidates;
  if (pool.length === 0) {
    return {
      onCourt: side.onCourt,
      slots: side.slots,
      substituted: false,
    };
  }

  let best: Player | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const candidate of pool) {
    const planned = plannedMinutesFor(management, candidate.id);
    const actual = (secondsOnCourt.get(candidate.id) ?? 0) / 60;
    const expected = planned * pace;
    const deficit = expected - actual;
    const starterBonus =
      management.startingLineup.some((row) => row.playerId === candidate.id)
        ? 2
        : 0;
    const score = deficit + starterBonus;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (best == null) {
    return {
      onCourt: side.onCourt,
      slots: side.slots,
      substituted: false,
    };
  }

  const nextOnCourt = [...side.onCourt];
  nextOnCourt[worstIndex] = best;
  const nextSlots = [...side.slots];
  if (nextSlots.length === nextOnCourt.length) {
    nextSlots[worstIndex] = slot;
  }

  return {
    onCourt: nextOnCourt,
    slots: nextSlots,
    substituted: true,
    playerOutId: playerOut.id,
    playerInId: best.id,
    emergencyMismatch: compatible.length === 0,
  };
}
