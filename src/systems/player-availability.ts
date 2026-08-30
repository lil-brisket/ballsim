/**
 * Canonical player availability gate for lineup / rotation / simulation.
 * UI and sim must use this — never hardcode injury/inactive checks in components.
 */

import {
  availabilityDisplayLabel,
  playerCanPlay,
  type Player,
  type PlayerAvailability as PlayerAvailabilityStatus,
} from "@/domain/entities/player";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

export type UnavailabilityReason =
  | "injured"
  | "inactive"
  | "not_on_roster"
  | "suspended"
  | "questionable"
  | "limited"
  | "minor"
  | "recovery";

/** Resolved gate result used by UI / sim / rotation. */
export type ResolvedPlayerAvailability = {
  available: boolean;
  /** True when the player may take the floor (available/questionable/limited/minor/recovery). */
  canPlay: boolean;
  status: PlayerAvailabilityStatus;
  reason?: UnavailabilityReason;
  label: string;
  injuryType: string | null;
  recommendedWorkloadMpg: number | null;
  maximumWorkloadMpg: number | null;
  /** Human-readable reason for workload restriction, if any. */
  limitReason: string | null;
  /** Legacy/migrated injury without medical detail. */
  isLegacyUndisclosed: boolean;
};

/** @deprecated Prefer {@link ResolvedPlayerAvailability}. */
export type PlayerAvailability = ResolvedPlayerAvailability;

const AVAILABILITY_LABELS: Record<UnavailabilityReason, string> = {
  injured: "Out",
  inactive: "Inactive",
  not_on_roster: "Not on roster",
  suspended: "Suspended",
  questionable: "Questionable",
  limited: "Limited",
  minor: "Minor",
  recovery: "Recovery",
};

function notOnRoster(): ResolvedPlayerAvailability {
  return {
    available: false,
    canPlay: false,
    status: "out",
    reason: "not_on_roster",
    label: AVAILABILITY_LABELS.not_on_roster,
    injuryType: null,
    recommendedWorkloadMpg: null,
    maximumWorkloadMpg: null,
    limitReason: null,
    isLegacyUndisclosed: false,
  };
}

function resolveFromPlayer(
  player: Player,
  inactive: boolean,
): ResolvedPlayerAvailability {
  const injuryType =
    player.injury?.type ??
    player.activeInjuries?.[0]?.type ??
    null;
  const isLegacyUndisclosed =
    (player.injury?.type === "Undisclosed" &&
      (player.injury.isLegacyData === true ||
        player.injury.severity === "moderate" &&
          player.injury.catalogKey === "undisclosed")) ||
    false;

  const primary = player.injury ?? player.activeInjuries?.[0] ?? null;

  if (player.suspension != null && player.suspension.gamesRemaining > 0) {
    return {
      available: false,
      canPlay: false,
      status: "suspended",
      reason: "suspended",
      label: AVAILABILITY_LABELS.suspended,
      injuryType,
      recommendedWorkloadMpg: null,
      maximumWorkloadMpg: null,
      limitReason: null,
      isLegacyUndisclosed,
    };
  }

  if (player.availability === "suspended") {
    return {
      available: false,
      canPlay: false,
      status: "suspended",
      reason: "suspended",
      label: AVAILABILITY_LABELS.suspended,
      injuryType,
      recommendedWorkloadMpg: null,
      maximumWorkloadMpg: null,
      limitReason: null,
      isLegacyUndisclosed,
    };
  }

  if (player.availability === "out") {
    return {
      available: false,
      canPlay: false,
      status: "out",
      reason: "injured",
      label: isLegacyUndisclosed
        ? "Out (details unavailable)"
        : injuryType
          ? `Out · ${injuryType}`
          : AVAILABILITY_LABELS.injured,
      injuryType,
      recommendedWorkloadMpg: primary?.recommendedWorkloadMpg ?? null,
      maximumWorkloadMpg: primary?.maximumWorkloadMpg ?? null,
      limitReason: injuryType
        ? `Unavailable due to ${injuryType.toLowerCase()}.`
        : "Player is out.",
      isLegacyUndisclosed,
    };
  }

  if (inactive) {
    return {
      available: false,
      canPlay: false,
      status: player.availability,
      reason: "inactive",
      label: AVAILABILITY_LABELS.inactive,
      injuryType,
      recommendedWorkloadMpg: primary?.recommendedWorkloadMpg ?? null,
      maximumWorkloadMpg: primary?.maximumWorkloadMpg ?? null,
      limitReason: null,
      isLegacyUndisclosed,
    };
  }

  if (player.availability === "limited" || player.availability === "recovery") {
    const recommended = primary?.recommendedWorkloadMpg ?? null;
    const status = player.availability;
    return {
      available: true,
      canPlay: true,
      status,
      reason: status === "recovery" ? "recovery" : "limited",
      label: injuryType
        ? `${availabilityDisplayLabel(status)} · ${injuryType}`
        : availabilityDisplayLabel(status),
      injuryType,
      recommendedWorkloadMpg: recommended,
      maximumWorkloadMpg: primary?.maximumWorkloadMpg ?? null,
      limitReason:
        recommended != null && injuryType
          ? `Medical recommendation is ${recommended} MPG due to ${injuryType.toLowerCase()}.`
          : recommended != null
            ? `Medical recommendation is ${recommended} MPG.`
            : "Player is medically limited.",
      isLegacyUndisclosed,
    };
  }

  if (
    player.availability === "questionable" ||
    player.availability === "minor"
  ) {
    const status = player.availability;
    return {
      available: true,
      canPlay: true,
      status,
      reason: status === "minor" ? "minor" : "questionable",
      label: injuryType
        ? `${availabilityDisplayLabel(status)} · ${injuryType}`
        : availabilityDisplayLabel(status),
      injuryType,
      recommendedWorkloadMpg: primary?.recommendedWorkloadMpg ?? null,
      maximumWorkloadMpg: primary?.maximumWorkloadMpg ?? null,
      limitReason: injuryType
        ? `Game-time decision due to ${injuryType.toLowerCase()}.`
        : "Game-time decision.",
      isLegacyUndisclosed,
    };
  }

  // available
  return {
    available: true,
    canPlay: playerCanPlay(player),
    status: "available",
    label: availabilityDisplayLabel("available"),
    injuryType: null,
    recommendedWorkloadMpg: null,
    maximumWorkloadMpg: null,
    limitReason: null,
    isLegacyUndisclosed: false,
  };
}

/**
 * Resolve whether a player may be selected as an active starter / rotation player.
 * Does not mutate state.
 */
export function getPlayerAvailability(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): ResolvedPlayerAvailability {
  const team = state.world.teams[teamId];
  if (team == null) {
    return notOnRoster();
  }

  if (!team.roster.includes(playerId)) {
    return notOnRoster();
  }

  const player = state.world.players[playerId];
  if (player == null) {
    return notOnRoster();
  }

  return resolveFromPlayer(
    player,
    team.rosterManagement.inactive.includes(playerId),
  );
}

export function isPlayerAvailable(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): boolean {
  return getPlayerAvailability(state, playerId, teamId).available;
}

/** True when player can take the floor (includes questionable / limited). */
export function canPlayerPlay(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): boolean {
  return getPlayerAvailability(state, playerId, teamId).canPlay;
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

/** Playable for rotation depth counting: available, questionable, or limited. */
export function listPlayableRosterPlayerIds(
  state: GameState,
  teamId: TeamId,
): PlayerId[] {
  const team = state.world.teams[teamId];
  if (team == null) {
    return [];
  }
  return team.roster.filter((playerId) =>
    canPlayerPlay(state, playerId, teamId),
  );
}
