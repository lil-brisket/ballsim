/**
 * Current-season top-league averages (regular + playoffs) for one player.
 * One definition shared by the player drawer and the roster sheet, so every
 * screen shows the same number.
 */

import type { PlayerId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createEmptyPlayerStatLine } from "@/domain/player-stat-aggregation";
import type { GameState } from "@/state/game-state";
import {
  toPlayerSeasonStatsViews,
  type PlayerSeasonStatsView,
} from "@/state/player-profile-selectors";

export type PlayerPerformanceView = {
  games: number;
  mpg: number | null;
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
  spg: number | null;
  bpg: number | null;
  /** Percent with one decimal (45.2); null without attempts. */
  fgPct: number | null;
  threePct: number | null;
  ftPct: number | null;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Pass `seasons` when the caller already built them (the drawer does). */
export function toPlayerPerformanceView(
  state: GameState,
  playerId: PlayerId,
  prebuiltSeasons?: PlayerSeasonStatsView[],
): PlayerPerformanceView {
  const player = state.world.players[playerId];
  const seasons =
    prebuiltSeasons ??
    (player
      ? toPlayerSeasonStatsViews(
          state,
          playerId,
          state.business.playerHistory[playerId],
          {
            age: player.age,
            overall: calculatePlayerOverall(player.position, player.attributes),
          },
        )
      : []);
  const line =
    seasons.find((entry) => entry.current)?.combined ??
    createEmptyPlayerStatLine();
  const games = line.games;
  const perGame = (total: number) => (games > 0 ? round1(total / games) : null);
  const pct = (made: number, attempted: number) =>
    attempted > 0 ? round1((made / attempted) * 100) : null;
  return {
    games,
    mpg: perGame(line.minutes),
    ppg: perGame(line.points),
    rpg: perGame(line.rebounds),
    apg: perGame(line.assists),
    spg: perGame(line.steals),
    bpg: perGame(line.blocks),
    fgPct: pct(line.fgMade, line.fgAttempted),
    threePct: pct(line.threeMade, line.threeAttempted),
    ftPct: pct(line.ftMade, line.ftAttempted),
  };
}
