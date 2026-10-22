import type { GameState } from "@/state/game-state";
import type { PlayoffSeriesIndex } from "./playoff-series";
import type { RefResolver } from "./refs";
import type { SeasonContext } from "./season-context";

export type DetectorInput = {
  state: GameState;
  ctx: SeasonContext;
  refs: RefResolver;
  series: PlayoffSeriesIndex;
  viewerTeamId: string;
};

/** Combine reason scores: strongest reason plus 10 per extra reason. */
export function combineNotability(scores: readonly number[]): number {
  if (scores.length === 0) return 0;
  const strongest = Math.max(...scores);
  return Math.min(100, Math.round(strongest + 10 * (scores.length - 1)));
}
