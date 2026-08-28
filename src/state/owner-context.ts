/**
 * Central owner-context helpers for multi-team Owner Mode.
 *
 * Terminology:
 * - ownedTeamIds — teams the player controls (simulation)
 * - activeOwnerTeamId — team the player is currently acting as (UI only)
 * - owned franchise — team + OwnedFranchiseState
 * - AI-controlled team — any team not in ownedTeamIds
 *
 * Simulation MUST key off ownedTeamIds, never activeOwnerTeamId.
 * UI mutations MUST key off activeOwnerTeamId.
 */

import type { Team } from "@/domain/entities/team";
import type { TeamId } from "@/domain/ids";
import {
  getBlockingOwnerDecisions,
  getPendingDecisionsForTeam as getPendingDecisionsForTeamFromUser,
  type PendingOwnerDecision,
} from "@/domain/entities/owner-decision";
import type {
  GameState,
  OwnedFranchiseState,
} from "@/state/game-state";

export function getOwnedTeamIds(state: GameState): readonly TeamId[] {
  return state.user.ownedTeamIds;
}

export function getActiveOwnerTeamId(state: GameState): TeamId {
  return state.user.activeOwnerTeamId;
}

/** True when the team is player-controlled (any owned franchise). */
export function isOwnedFranchise(state: GameState, teamId: TeamId): boolean {
  return state.user.ownedTeamIds.includes(teamId);
}

/** True when the team is not player-controlled. */
export function isAiControlledTeam(state: GameState, teamId: TeamId): boolean {
  return !isOwnedFranchise(state, teamId);
}

/**
 * Alias for {@link isOwnedFranchise}.
 * Prefer isOwnedFranchise in new code; kept for AI decision call sites.
 */
export function isUserControlledTeam(
  state: GameState,
  teamId: TeamId,
): boolean {
  return isOwnedFranchise(state, teamId);
}

export function getOwnedFranchise(
  state: GameState,
  teamId: TeamId,
): OwnedFranchiseState {
  const franchise = state.user.ownedFranchises[teamId];
  if (!franchise) {
    throw new Error(
      `Owned franchise state missing for team "${teamId}".`,
    );
  }
  return franchise;
}

export function getOwnedFranchiseOrUndefined(
  state: GameState,
  teamId: TeamId,
): OwnedFranchiseState | undefined {
  return state.user.ownedFranchises[teamId];
}

export function getActiveOwnedFranchise(state: GameState): OwnedFranchiseState {
  return getOwnedFranchise(state, state.user.activeOwnerTeamId);
}

/** AI management config for an owned franchise (not career settings.ai). */
export function getOwnedFranchiseAssistance(
  state: GameState,
  teamId: TeamId = state.user.activeOwnerTeamId,
): {
  managementPreset: OwnedFranchiseState["managementPreset"];
  aiAssistance: OwnedFranchiseState["aiAssistance"];
} {
  const franchise = getOwnedFranchise(state, teamId);
  return {
    managementPreset: franchise.managementPreset,
    aiAssistance: franchise.aiAssistance,
  };
}

export function getActiveTeam(state: GameState): Team {
  const teamId = state.user.activeOwnerTeamId;
  const team = state.world.teams[teamId];
  if (!team) {
    throw new Error(
      `Active owner team "${teamId}" is missing from world.teams.`,
    );
  }
  return team;
}

/**
 * @deprecated Prefer {@link getActiveTeam}. Alias during call-site migration.
 */
export function getControlledTeam(state: GameState): Team {
  return getActiveTeam(state);
}

export function withActiveOwnerTeam(
  state: GameState,
  teamId: TeamId,
): GameState {
  if (!isOwnedFranchise(state, teamId)) {
    throw new Error(
      `Cannot set active owner team to "${teamId}" — not in ownedTeamIds.`,
    );
  }
  if (state.user.activeOwnerTeamId === teamId) {
    return state;
  }
  return {
    ...state,
    user: {
      ...state.user,
      activeOwnerTeamId: teamId,
    },
  };
}

export function withOwnedFranchise(
  state: GameState,
  teamId: TeamId,
  updater:
    | OwnedFranchiseState
    | ((current: OwnedFranchiseState) => OwnedFranchiseState),
): GameState {
  const current = getOwnedFranchise(state, teamId);
  const next =
    typeof updater === "function" ? updater(current) : updater;
  if (next === current) {
    return state;
  }
  return {
    ...state,
    user: {
      ...state.user,
      ownedFranchises: {
        ...state.user.ownedFranchises,
        [teamId]: next,
      },
    },
  };
}

export function getPendingDecisionsForTeam(
  state: GameState,
  teamId: TeamId,
): PendingOwnerDecision[] {
  return getPendingDecisionsForTeamFromUser(state.user, teamId);
}

export function getBlockingDecisions(
  state: GameState,
): PendingOwnerDecision[] {
  return getBlockingOwnerDecisions(state.user);
}

/**
 * Add a team to ownedTeamIds with franchise state.
 * Architecture supports release later; this is the reverse of relinquish.
 */
export function withAddedOwnedFranchise(
  state: GameState,
  teamId: TeamId,
  franchise: OwnedFranchiseState,
  options: { setActive?: boolean } = {},
): GameState {
  if (isOwnedFranchise(state, teamId)) {
    return withOwnedFranchise(state, teamId, franchise);
  }
  const ownedTeamIds = [...state.user.ownedTeamIds, teamId];
  return {
    ...state,
    user: {
      ...state.user,
      ownedTeamIds,
      activeOwnerTeamId: options.setActive
        ? teamId
        : state.user.activeOwnerTeamId,
      ownedFranchises: {
        ...state.user.ownedFranchises,
        [teamId]: franchise,
      },
    },
  };
}

/**
 * Remove a franchise from player control (architecture for future Release Control).
 * If releasing the active team, activates the first remaining owned team.
 */
export function withRelinquishedOwnedFranchise(
  state: GameState,
  teamId: TeamId,
): GameState {
  if (!isOwnedFranchise(state, teamId)) {
    return state;
  }
  const ownedTeamIds = state.user.ownedTeamIds.filter((id) => id !== teamId);
  if (ownedTeamIds.length === 0) {
    throw new Error("Cannot relinquish the last owned franchise.");
  }
  const { [teamId]: _removed, ...ownedFranchises } =
    state.user.ownedFranchises;
  const activeOwnerTeamId =
    state.user.activeOwnerTeamId === teamId
      ? ownedTeamIds[0]!
      : state.user.activeOwnerTeamId;
  return {
    ...state,
    user: {
      ...state.user,
      ownedTeamIds,
      activeOwnerTeamId,
      ownedFranchises,
    },
  };
}
