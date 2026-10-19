import type { PlayerPosition } from "@/domain/entities/player";
import { asGameId, type PlayerId } from "@/domain/ids";
import { formatGameClock, periodLabel } from "@/state/watch-game-selectors";
import type {
  WatchGameView,
  WatchPlay,
  WatchPlayKind,
  WatchPlayer,
  WatchSide,
} from "@/state/watch-game-view";

export type FixturePlay = {
  period?: number;
  poss: number;
  kind: WatchPlayKind;
  side: WatchSide;
  playerId: string;
  player2Id?: string | null;
  points?: number;
};

const POSITIONS: PlayerPosition[] = ["PG", "SG", "SF", "PF", "C"];

/**
 * Hand-built watch view: five starters a side (h1..h5, a1..a5) at PG, SG, SF,
 * PF, C, so each team's centre is number 5. `positions: null` strips them.
 */
export function fixtureView(
  gameId: string,
  plays: FixturePlay[],
  options: {
    positions?: PlayerPosition[] | null;
    /** Extra non-starters a side (h6.., a6..), in roster order after the starters. */
    bench?: number;
  } = {},
): WatchGameView {
  const positions =
    options.positions === undefined ? POSITIONS : options.positions;
  const players: WatchPlayer[] = ([0, 1] as const).flatMap((side) =>
    Array.from({ length: 5 + (options.bench ?? 0) }, (_, i) => i + 1).map(
      (n) => ({
        playerId: `${side === 0 ? "h" : "a"}${n}` as PlayerId,
        side,
        fullName: `Pat ${side === 0 ? "h" : "a"}${n}`,
        shortName: `P. ${side === 0 ? "h" : "a"}${n}`,
        lastName: `${side === 0 ? "h" : "a"}${n}`,
        position: positions ? (positions[n - 1] ?? null) : null,
        jerseyNumber: null,
        started: n <= 5,
        finalMinutes: 0,
      }),
    ),
  );
  return {
    gameId: asGameId(gameId),
    date: "2026-10-17",
    competitionType: "regular_season",
    home: { abbreviation: "HOM" } as never,
    away: { abbreviation: "AWY" } as never,
    finalScore: { home: 0, away: 0 },
    periodScores: [],
    players,
    plays: plays.map((p, index): WatchPlay => {
      const period = p.period ?? 1;
      return {
        index,
        period,
        periodLabel: periodLabel(period),
        clock: 600,
        clockLabel: formatGameClock(600),
        poss: p.poss,
        kind: p.kind,
        side: p.side,
        playerId: p.playerId as PlayerId,
        player2Id: (p.player2Id ?? null) as PlayerId | null,
        text: p.kind,
        points: p.points ?? 0,
        homeScore: 0,
        awayScore: 0,
        highlights: [],
      };
    }),
    keyMoments: [],
    shotSummary: {} as never,
    injuries: [],
  };
}

/**
 * Home leads Q1 (attacks left). Covers every way a possession can start:
 * tip, made-basket inbound, out-of-bounds turnover, steal, defensive
 * rebound, foul (same end and new end) and a new period.
 *
 *  0 home make         -> tip, then away inbounds under the basket (made)
 *  1 away OOB turnover -> home inbounds from the sideline (new end)
 *  2 home miss, 3 away defensive rebound
 *  4 away stolen       -> home's possession (5) is live
 *  5 home miss, 6 away fouls home
 *  7 home make         -> home keeps the ball: sideline inbound, same end
 *  8 home offensive foul -> away inbounds from the sideline (new end)
 * 10 Q2 away make      -> baseline inbound
 */
export const RESTART_PLAYS: FixturePlay[] = [
  { poss: 1, kind: "two_made", side: 0, playerId: "h1", points: 2 },
  { poss: 2, kind: "turnover", side: 1, playerId: "a1" },
  { poss: 3, kind: "two_missed", side: 0, playerId: "h2" },
  { poss: 3, kind: "defensive_rebound", side: 1, playerId: "a2" },
  { poss: 4, kind: "turnover", side: 1, playerId: "a3", player2Id: "h3" },
  { poss: 5, kind: "two_missed", side: 0, playerId: "h4" },
  {
    poss: 5,
    kind: "personal_foul",
    side: 1,
    playerId: "a4",
    player2Id: "h4",
  },
  { poss: 6, kind: "two_made", side: 0, playerId: "h5", points: 2 },
  { poss: 6, kind: "offensive_foul", side: 0, playerId: "h1" },
  { poss: 7, kind: "two_missed", side: 1, playerId: "a5" },
  { period: 2, poss: 8, kind: "two_made", side: 1, playerId: "a1", points: 2 },
];
