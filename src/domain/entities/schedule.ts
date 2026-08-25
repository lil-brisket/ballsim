import type { GameId, SeasonId } from "@/domain/ids";

export type Schedule = {
  seasonId: SeasonId;
  gameIds: GameId[];
  /**
   * Optional date → schedule gameIds index for O(1) daily lookup.
   * Rebuilt on demand when missing (legacy saves / empty schedule).
   */
  gameIdsByDate?: Record<string, GameId[]>;
};
