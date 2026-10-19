/**
 * Opening tip for the Watch Game page. The play-by-play log has no jump-ball
 * row, so the viewer infers one: each team sends its starting centre (or the
 * best-fitting starter when it has none), and the team with the first
 * possession wins the tip. Presentation only, derived from the log and never
 * stored, so it changes no box score or score replay.
 */
import type { PlayerId } from "@/domain/ids";
import type { PlayerPosition } from "@/domain/entities/player";
import { possessionGroups } from "@/state/watch-court-frame";
import { lineupAt } from "@/state/watch-game-selectors";
import type { WatchGameView, WatchSide } from "@/state/watch-game-view";

/** Taller positions first; an unknown position ranks last. */
const JUMPER_RANK: Record<PlayerPosition, number> = {
  C: 0,
  PF: 1,
  SF: 2,
  SG: 3,
  PG: 4,
};

/**
 * The player who jumps for a team: its centre, otherwise the next-tallest
 * position, ties broken by lineup order. Deterministic; null for an empty
 * lineup.
 */
export function pickJumper(
  view: WatchGameView,
  lineup: readonly PlayerId[],
): PlayerId | null {
  const position = new Map(view.players.map((p) => [p.playerId, p.position]));
  let best: PlayerId | null = null;
  let bestRank = Infinity;
  for (const id of lineup) {
    const found = position.get(id);
    const rank = found ? JUMPER_RANK[found] : Object.keys(JUMPER_RANK).length;
    if (rank < bestRank) {
      best = id;
      bestRank = rank;
    }
  }
  return best;
}

export type JumpBall = {
  /** Home then away jumper (null when a side has nobody on the floor). */
  jumpers: [PlayerId | null, PlayerId | null];
  /** The team that gains possession: the first possession's team. */
  possession: WatchSide;
};

/** The inferred opening tip; null when the log has no non-substitution play. */
export function jumpBall(view: WatchGameView): JumpBall | null {
  const first = possessionGroups(view)[0];
  if (!first) {
    return null;
  }
  const lineups = lineupAt(view, 0);
  return {
    jumpers: [pickJumper(view, lineups[0]), pickJumper(view, lineups[1])],
    possession: first.offenseSide,
  };
}

/** Feed line for the tip, e.g. "Jump ball: A. Smith vs B. Jones — BOS gains possession". */
export function jumpBallText(view: WatchGameView): string | null {
  const tip = jumpBall(view);
  if (!tip) {
    return null;
  }
  const name = (id: PlayerId | null) =>
    view.players.find((p) => p.playerId === id)?.shortName ?? "—";
  const team = tip.possession === 0 ? view.home : view.away;
  return `Jump ball: ${name(tip.jumpers[0])} vs ${name(tip.jumpers[1])} — ${team.abbreviation} gains possession`;
}
