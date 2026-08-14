import type { GameId, PlayerId, SeasonId, TeamId } from "@/domain/ids";

export type GameStatus = "scheduled" | "final";

export type PlayerGameStats = {
  playerId: PlayerId;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
};

export type Game = {
  id: GameId;
  seasonId: SeasonId;
  date: string;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
  boxScore: PlayerGameStats[] | null;
};
