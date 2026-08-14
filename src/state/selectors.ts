import type { Team } from "@/domain/entities/team";
import type { GameState } from "@/state/game-state";

export type DashboardSnapshot = {
  saveId: string;
  schemaVersion: number;
  currentDate: string;
  seasonYear: number;
  seasonPhase: string;
  leagueName: string;
  mode: string;
  controlledTeam: {
    id: string;
    city: string;
    name: string;
    abbreviation: string;
  };
  teamCount: number;
  playerCount: number;
};

export function getControlledTeam(state: GameState): Team {
  const team = state.world.teams[state.user.controlledTeamId];
  if (!team) {
    throw new Error(
      `Controlled team ${state.user.controlledTeamId} is missing from world.teams.`,
    );
  }
  return team;
}

export function toDashboardSnapshot(state: GameState): DashboardSnapshot {
  const team = getControlledTeam(state);
  return {
    saveId: state.meta.saveId,
    schemaVersion: state.meta.schemaVersion,
    currentDate: state.world.calendar.currentDate,
    seasonYear: state.competition.season.year,
    seasonPhase: state.competition.season.phase,
    leagueName: state.world.league.name,
    mode: state.user.mode,
    controlledTeam: {
      id: team.id,
      city: team.city,
      name: team.name,
      abbreviation: team.abbreviation,
    },
    teamCount: Object.keys(state.world.teams).length,
    playerCount: Object.keys(state.world.players).length,
  };
}
