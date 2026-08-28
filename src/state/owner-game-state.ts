import type { Game } from "@/domain/entities/game";
import type { League } from "@/domain/entities/league";
import type { OwnerNotification } from "@/domain/entities/owner-notification";
import type { OwnerObjective } from "@/domain/entities/owner-objective";
import type { TeamFinances } from "@/domain/entities/finances";
import type { PlayoffTournament } from "@/domain/entities/playoffs";
import type { Schedule } from "@/domain/entities/schedule";
import type { Season } from "@/domain/entities/season";
import type { Standings } from "@/domain/entities/standings";
import type { Team } from "@/domain/entities/team";
import type {
  CoachId,
  PlayerId,
  SeasonId,
  StaffId,
  TeamId,
} from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getActiveOwnedFranchise } from "@/state/owner-context";

/**
 * Coach/staff id lists for the selected team.
 * Newly allocated id arrays; entities resolve in world.coaches / world.staff.
 */
export type OwnerStaffState = {
  coachIds: CoachId[];
  staffIds: StaffId[];
};

/**
 * View grouping of existing GameState references for Owner Mode convenience.
 * Not an independently authoritative league model — mutate standings/games/teams
 * on GameState, not via this view as a separate source of truth.
 */
export type OwnerLeagueState = {
  league: League;
  teams: Record<string, Team>;
  season: Season;
  schedule: Schedule;
  games: Record<string, Game>;
  standings: Standings;
  playoffs: PlayoffTournament;
};

/**
 * Derived management-layer view over GameState.
 * Must never be added as a field on GameState, serialized independently,
 * or given its own schema version.
 *
 * Read-only projection: arrays/objects are live references for convenience.
 * Callers must not mutate them; all writes go through GameState systems.
 */
export type OwnerGameState = {
  currentDate: string;
  currentSeasonId: SeasonId;
  selectedTeamId: TeamId;
  objectives: readonly OwnerObjective[];
  notifications: readonly OwnerNotification[];
  finances: TeamFinances;
  staff: OwnerStaffState;
  roster: readonly PlayerId[];
  leagueState: OwnerLeagueState;
};

/**
 * Builds a live-reference Owner Mode view from the authoritative GameState.
 * Does not deep-clone canonical state. objectives, notifications, finances,
 * roster, and OwnerLeagueState collections preserve references to their
 * canonical sources. Callers must not mutate those references.
 */
export function toOwnerGameState(state: GameState): OwnerGameState {
  const selectedTeamId = state.user.activeOwnerTeamId;
  const team = state.world.teams[selectedTeamId];
  if (!team) {
    throw new Error(
      `Owner Mode selectedTeamId "${selectedTeamId}" is missing from world.teams.`,
    );
  }

  const season = state.competition.season;
  if (!season || typeof season.id !== "string" || season.id.length === 0) {
    throw new Error(
      "Owner Mode currentSeasonId requires a valid competition.season.id.",
    );
  }

  const finances = state.business.finances[selectedTeamId];
  if (!finances) {
    throw new Error(
      `Owner Mode finances for team "${selectedTeamId}" are missing from business.finances.`,
    );
  }

  for (const playerId of team.roster) {
    if (!state.world.players[playerId]) {
      throw new Error(
        `Owner Mode roster player "${playerId}" is missing from world.players.`,
      );
    }
  }

  for (const staffId of team.staff) {
    if (!state.world.staff[staffId]) {
      throw new Error(
        `Owner Mode staff "${staffId}" is missing from world.staff.`,
      );
    }
  }

  const coachIds: CoachId[] = [];
  for (const [coachId, coach] of Object.entries(state.world.coaches)) {
    if (coach.teamId === selectedTeamId) {
      if (coach.id !== coachId) {
        throw new Error(
          `Owner Mode coach key "${coachId}" does not match coach.id.`,
        );
      }
      coachIds.push(coach.id);
    }
  }

  return {
    currentDate: state.world.calendar.currentDate,
    currentSeasonId: season.id,
    selectedTeamId,
    objectives: getActiveOwnedFranchise(state).objectives,
    notifications: getActiveOwnedFranchise(state).notifications,
    finances,
    staff: {
      coachIds,
      staffIds: [...team.staff],
    },
    roster: team.roster,
    leagueState: {
      league: state.world.league,
      teams: state.world.teams,
      season: state.competition.season,
      schedule: state.competition.schedule,
      games: state.competition.games,
      standings: state.competition.standings,
      playoffs: state.competition.playoffs,
    },
  };
}
