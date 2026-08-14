import type { GameId, SeasonId } from "@/domain/ids";

export type Schedule = {
  seasonId: SeasonId;
  gameIds: GameId[];
};
