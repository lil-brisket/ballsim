/**
 * Canonical player availability gate for lineup / rotation / simulation.
 * UI and sim must use this — never hardcode injury/inactive checks in components.
 */

import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

export type UnavailabilityReason =
  | "injured"
  | "inactive"
  | "not_on_roster"
  | "suspended";

export type PlayerAvailability = {
  available: boolean;
  reason?: UnavailabilityReason;
  label: string;
};

const AVAILABILITY_LABELS: Record<UnavailabilityReason, string> = {
  injured: "Injured",
  inactive: "Inactive",
  not_on_roster: "Not on roster",
  suspended: "Suspended",
};

/**
 * Resolve whether a player may be selected as an active starter / rotation player.
 * Does not mutate state.
 */
export function getPlayerAvailability(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): PlayerAvailability {
  const team = state.world.teams[teamId];
  if (team == null) {
    return {
      available: false,
      reason: "not_on_roster",
      label: AVAILABILITY_LABELS.not_on_roster,
    };
  }

  if (!team.roster.includes(playerId)) {
    return {
      available: false,
      reason: "not_on_roster",
      label: AVAILABILITY_LABELS.not_on_roster,
    };
  }

  const player = state.world.players[playerId];
  if (player == null) {
    return {
      available: false,
      reason: "not_on_roster",
      label: AVAILABILITY_LABELS.not_on_roster,
    };
  }

  if (player.injury.kind === "injured") {
    return {
      available: false,
      reason: "injured",
      label: AVAILABILITY_LABELS.injured,
    };
  }

  if (team.rosterManagement.inactive.includes(playerId)) {
    return {
      available: false,
      reason: "inactive",
      label: AVAILABILITY_LABELS.inactive,
    };
  }

  return { available: true, label: "Available" };
}

export function isPlayerAvailable(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): boolean {
  return getPlayerAvailability(state, playerId, teamId).available;
}

export function listAvailableRosterPlayerIds(
  state: GameState,
  teamId: TeamId,
): PlayerId[] {
  const team = state.world.teams[teamId];
  if (team == null) {
    return [];
  }
  return team.roster.filter((playerId) =>
    isPlayerAvailable(state, playerId, teamId),
  );
}
