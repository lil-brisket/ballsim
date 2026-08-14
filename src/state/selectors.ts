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
  controlledStanding: {
    wins: number;
    losses: number;
  };
  recentResults: Array<{
    date: string;
    opponentAbbreviation: string;
    home: boolean;
    teamScore: number;
    opponentScore: number;
    won: boolean;
  }>;
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
  const standing = state.competition.standings.byTeamId[team.id] ?? {
    teamId: team.id,
    wins: 0,
    losses: 0,
  };

  const recentResults = Object.values(state.competition.games)
    .filter(
      (game) =>
        game.status === "final" &&
        (game.homeTeamId === team.id || game.awayTeamId === team.id) &&
        game.homeScore !== null &&
        game.awayScore !== null,
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
    .map((game) => {
      const home = game.homeTeamId === team.id;
      const teamScore = home ? game.homeScore! : game.awayScore!;
      const opponentScore = home ? game.awayScore! : game.homeScore!;
      const opponentId = home ? game.awayTeamId : game.homeTeamId;
      const opponent = state.world.teams[opponentId];
      return {
        date: game.date,
        opponentAbbreviation: opponent?.abbreviation ?? "???",
        home,
        teamScore,
        opponentScore,
        won: teamScore > opponentScore,
      };
    });

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
    controlledStanding: {
      wins: standing.wins,
      losses: standing.losses,
    },
    recentResults,
  };
}
