/**
 * Assign / recall players to the Development League.
 * Removes from Team.roster on assign; keeps Player.teamId as franchise ownership.
 */

import {
  createDefaultDevelopmentLeagueProfile,
  type DevelopmentLeagueProfile,
  type DevelopmentLeagueRole,
} from "@/domain/entities/development-league";
import { createPlayer, type Player } from "@/domain/entities/player";
import type { Team } from "@/domain/entities/team";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { PlayerId, TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import { findPlayerDraftSeasonYear } from "@/systems/development-league/eligibility";
import {
  validateAssignToDevelopmentLeague,
  validateRecallFromDevelopmentLeague,
} from "@/systems/development-league/validation";
import { reconcileRosterManagement } from "@/systems/roster-management";

export type DlAssignmentResult = {
  success: boolean;
  errors: string[];
  state: GameState;
  events: DomainEvent[];
};

function deriveInitialDlRole(player: Player, dlPeers: Player[]): DevelopmentLeagueRole {
  const overall = calculatePlayerOverall(player.position, player.attributes);
  const peers = [...dlPeers, player].sort(
    (a, b) =>
      calculatePlayerOverall(b.position, b.attributes) -
      calculatePlayerOverall(a.position, a.attributes),
  );
  const rank = peers.findIndex((p) => p.id === player.id);
  if (rank >= 0 && rank < 5) return "starter";
  if (rank >= 0 && rank < 9) return "rotation";
  return "development";
}

export function assignPlayerToDevelopmentLeague(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): DlAssignmentResult {
  const validation = validateAssignToDevelopmentLeague(state, playerId, teamId);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      state,
      events: [],
    };
  }

  const player = state.world.players[playerId]!;
  const team = state.world.teams[teamId] as Team;
  const draftSeasonYear =
    player.developmentLeague?.draftSeasonYear ??
    findPlayerDraftSeasonYear(playerId, state);

  const peers: Player[] = [];
  for (const other of Object.values(state.world.players)) {
    if (
      other.teamId === teamId &&
      other.developmentLeague?.status === "assigned" &&
      other.id !== playerId
    ) {
      peers.push(other);
    }
  }
  const role = deriveInitialDlRole(player, peers);
  const prior = player.developmentLeague ?? createDefaultDevelopmentLeagueProfile();
  const nextProfile: DevelopmentLeagueProfile = {
    ...prior,
    status: "assigned",
    parentTeamId: teamId,
    role,
    assignedThisSeason: true,
    dlAssignmentLockedThisSeason: false,
    firstAssignedSeasonYear:
      prior.firstAssignedSeasonYear ?? state.competition.season.year,
    draftSeasonYear,
  };

  const updatedPlayer = createPlayer({
    ...player,
    developmentLeague: nextProfile,
  });

  const nextRoster = team.roster.filter((id) => id !== playerId);
  const updatedTeam: Team = {
    ...team,
    roster: nextRoster,
  };

  let next: GameState = {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: updatedPlayer,
      },
      teams: {
        ...state.world.teams,
        [teamId]: updatedTeam,
      },
    },
  };
  next = reconcileRosterManagement(next, teamId);

  const event = createDomainEvent({
    type: "PlayerAssignedToDevelopmentLeague",
    occurredOn: state.world.calendar.currentDate,
    payload: {
      playerId,
      teamId,
      role,
      seasonsUsed: nextProfile.seasonsUsed,
      seasonsRemaining: Math.max(0, 3 - nextProfile.seasonsUsed),
    },
  });
  next = appendSeasonEventLog(next, [event]);

  return {
    success: true,
    errors: [],
    state: next,
    events: [event],
  };
}

export function recallPlayerFromDevelopmentLeague(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): DlAssignmentResult {
  const validation = validateRecallFromDevelopmentLeague(
    state,
    playerId,
    teamId,
  );
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
      state,
      events: [],
    };
  }

  const player = state.world.players[playerId]!;
  const team = state.world.teams[teamId] as Team;
  const prior = player.developmentLeague ?? createDefaultDevelopmentLeagueProfile();

  const nextProfile: DevelopmentLeagueProfile = {
    ...prior,
    status: "none",
    parentTeamId: null,
    role: "development",
    dlAssignmentLockedThisSeason: true,
  };

  const updatedPlayer = createPlayer({
    ...player,
    teamId,
    developmentLeague: nextProfile,
  });

  const updatedTeam: Team = {
    ...team,
    roster: team.roster.includes(playerId)
      ? team.roster
      : [...team.roster, playerId],
  };

  let next: GameState = {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: updatedPlayer,
      },
      teams: {
        ...state.world.teams,
        [teamId]: updatedTeam,
      },
    },
  };
  next = reconcileRosterManagement(next, teamId);

  const event = createDomainEvent({
    type: "PlayerRecalledFromDevelopmentLeague",
    occurredOn: state.world.calendar.currentDate,
    payload: {
      playerId,
      teamId,
      seasonsUsed: nextProfile.seasonsUsed,
      lockedThisSeason: true,
    },
  });
  next = appendSeasonEventLog(next, [event]);

  return {
    success: true,
    errors: [],
    state: next,
    events: [event],
  };
}
