import type { GameId, SeasonId, TeamId } from "@/domain/ids";

export type GameStatus = "scheduled" | "final";

export type Game = {
  id: GameId;
  seasonId: SeasonId;
  date: string;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  status: GameStatus;
  homeScore: number | null;
  awayScore: number | null;
};
