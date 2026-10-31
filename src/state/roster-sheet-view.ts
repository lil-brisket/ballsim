/**
 * The row shape the roster sheet needs, and a pure selector that builds it for
 * any player in the league. Read-only; nothing here is stored.
 */

import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import {
  availabilityDisplayLabel,
  playerCanPlay,
  type PlayerAttributes,
  type PlayerPosition,
} from "@/domain/entities/player";
import { ARCHETYPE_LABELS } from "@/domain/entities/player-archetype";
import { getContractSalaryForYear } from "@/domain/entities/contract";
import type { RotationRole } from "@/domain/entities/team-roster-management";
import type { PlayerId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import {
  toPlayerPerformanceView,
  type PlayerPerformanceView,
} from "@/state/player-performance";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { isFreeAgent } from "@/systems/free-agency";

export type SheetPlayerView = {
  playerId: string;
  portrait: PlayerPortraitAssignment | null;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  position: string;
  primaryPosition: PlayerPosition;
  age: number;
  overall: number;
  potential: number;
  attributes: PlayerAttributes;
  heightInches: number;
  weightPounds: number;
  archetypeLabel: string;
  performance: PlayerPerformanceView;
  canPlay: boolean;
  availabilityLabel: string;
  injuryKind: string;
  /** Only rostered players have a rotation role; rows without one are ungrouped. */
  rotationRole?: RotationRole | null;
  contractSalary: number | null;
  contractYearsRemaining: number | null;
  onTradeBlock?: boolean;
};

/**
 * Availability for a player who may have no team. The roster gate
 * (getPlayerAvailability) reports "not on roster" for free agents, so the
 * label is derived from the player's own availability.
 */
function standaloneAvailability(
  state: GameState,
  playerId: PlayerId,
): { canPlay: boolean; label: string } {
  const player = state.world.players[playerId]!;
  const injuryType =
    player.injury?.type ?? player.activeInjuries?.[0]?.type ?? null;
  const suspended =
    player.availability === "suspended" ||
    (player.suspension != null && player.suspension.gamesRemaining > 0);
  if (suspended) return { canPlay: false, label: "Suspended" };
  if (player.availability === "out") {
    return {
      canPlay: false,
      label: injuryType ? `Out · ${injuryType}` : "Out",
    };
  }
  const base = availabilityDisplayLabel(player.availability);
  return {
    canPlay: playerCanPlay(player),
    label:
      player.availability !== "available" && injuryType
        ? `${base} · ${injuryType}`
        : base,
  };
}

/**
 * A sheet row for any player. Free agents carry no contract; rostered players
 * carry their current salary and years left. `overrides` lets a caller add
 * context the league state does not hold (a rotation role, the trade block).
 */
export function toSheetPlayerView(
  state: GameState,
  playerId: PlayerId,
  overrides: Partial<SheetPlayerView> = {},
): SheetPlayerView | null {
  const player = state.world.players[playerId];
  if (!player) return null;
  const year = state.competition.season.year;
  const contract =
    !isFreeAgent(state, playerId) && player.contractId
      ? state.business.contracts[player.contractId]
      : undefined;
  const availability = standaloneAvailability(state, playerId);

  return {
    playerId: player.id,
    portrait: selectPlayerPortrait(state, player.id),
    firstName: player.firstName,
    lastName: player.lastName,
    jerseyNumber: player.jerseyNumber,
    position: player.position,
    primaryPosition: player.position,
    age: player.age,
    overall: calculatePlayerOverall(player.position, player.attributes),
    potential: player.potential.overall,
    attributes: { ...player.attributes },
    heightInches: player.heightInches,
    weightPounds: player.weightPounds,
    archetypeLabel: ARCHETYPE_LABELS[player.archetype],
    performance: toPlayerPerformanceView(state, playerId),
    canPlay: availability.canPlay,
    availabilityLabel: availability.label,
    injuryKind: player.availability,
    contractSalary:
      contract !== undefined
        ? (getContractSalaryForYear(contract, year) ?? null)
        : null,
    contractYearsRemaining:
      contract !== undefined ? Math.max(0, contract.endYear - year + 1) : null,
    ...overrides,
  };
}
