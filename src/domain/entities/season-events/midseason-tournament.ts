import type { GameId, PlayoffSeriesId, SeasonId, TeamId } from "@/domain/ids";
import type {
  PlayoffSeed,
  PlayoffSeries,
  PlayoffTournamentStatus,
} from "@/domain/entities/playoffs";

export type MidseasonTournamentFormat =
  | "regional"
  | "conference"
  | "division"
  | "country"
  | "state";

export type MidseasonTournamentState = {
  seasonId: SeasonId;
  format: MidseasonTournamentFormat;
  status: PlayoffTournamentStatus;
  startDate: string;
  endDate: string | null;
  fieldSize: number;
  qualifiedTeams: PlayoffSeed[];
  series: PlayoffSeries[];
  championTeamId?: TeamId;
  /** Games created for this tournament (also in competition.games). */
  gameIds: GameId[];
};

export function createEmptyMidseasonTournament(
  seasonId: SeasonId,
): MidseasonTournamentState {
  return {
    seasonId,
    format: "conference",
    status: "not_started",
    startDate: "",
    endDate: null,
    fieldSize: 0,
    qualifiedTeams: [],
    series: [],
    gameIds: [],
  };
}

export type { PlayoffSeriesId };
