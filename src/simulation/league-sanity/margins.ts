/**
 * Game-margin diagnostics for a simulated league: how lopsided games are,
 * and how much of that spread comes from team strength versus game noise.
 */

import type { Game } from "@/domain/entities/game";

/**
 * Rough NBA reference points (recent regular seasons), for side-by-side
 * reading only. Not a gate.
 */
export const NBA_MARGIN_REFERENCE = {
  meanAbsMargin: 12.5,
  blowoutShare: 0.2,
  closeShare: 0.12,
  residualMarginSd: 12.5,
  winPctSd: 0.15,
} as const;

/** Games decided by at least this many points count as blowouts. */
const BLOWOUT_MARGIN = 20;
/** Games decided by at most this many points count as close. */
const CLOSE_MARGIN = 3;

export type MarginSummary = {
  games: number;
  teamPoints: number;
  meanAbsMargin: number;
  /** SD of the home-minus-away margin. */
  marginSd: number;
  /** Share of games decided by >= 20 points. */
  blowoutShare: number;
  /** Share of games decided by <= 3 points. */
  closeShare: number;
  overtimeShare: number;
  homeWinShare: number;
  /** Mean home-minus-away margin (home edge in points). */
  homeEdge: number;
  /**
   * SD of the margin left after removing team strength (each team's
   * season point differential, assuming a balanced schedule) and the home
   * edge: the game-to-game noise. Strength is fitted from the same games,
   * which slightly understates the noise in short seasons.
   */
  residualMarginSd: number;
  /** SD of team win percentage across the league. */
  winPctSd: number;
  bestWinPct: number;
  worstWinPct: number;
};

/**
 * Summarizes final games. Pass one season (one league) at a time: team
 * strength is estimated from these same games.
 */
export function summarizeGameMargins(games: readonly Game[]): MarginSummary {
  const finals = games.filter((game) => game.status === "final");
  if (finals.length === 0) {
    throw new Error("summarizeGameMargins requires at least one final game.");
  }

  const teams = new Map<
    string,
    { games: number; wins: number; differential: number }
  >();
  const team = (id: string) => {
    let entry = teams.get(id);
    if (entry == null) {
      entry = { games: 0, wins: 0, differential: 0 };
      teams.set(id, entry);
    }
    return entry;
  };

  const margins = finals.map((game) => game.score.home - game.score.away);
  finals.forEach((game, index) => {
    const margin = margins[index]!;
    const home = team(game.homeTeamId);
    const away = team(game.awayTeamId);
    home.games += 1;
    away.games += 1;
    home.differential += margin;
    away.differential -= margin;
    if (margin > 0) {
      home.wins += 1;
    } else {
      away.wins += 1;
    }
  });

  const homeEdge = mean(margins);
  // A team's differential is its strength minus its opponents' average, so on
  // a balanced schedule of N teams two differentials differ by N/(N-1) times
  // the strength gap between those teams.
  const scheduleFactor = (teams.size - 1) / teams.size;
  const residuals = finals.map((game, index) => {
    const home = teams.get(game.homeTeamId)!;
    const away = teams.get(game.awayTeamId)!;
    const expected =
      scheduleFactor *
        (home.differential / home.games - away.differential / away.games) +
      homeEdge;
    return margins[index]! - expected;
  });

  const winPcts = [...teams.values()].map((entry) => entry.wins / entry.games);
  const absMargins = margins.map(Math.abs);
  const teamPoints =
    finals.reduce((sum, game) => sum + game.score.home + game.score.away, 0) /
    (2 * finals.length);

  return {
    games: finals.length,
    teamPoints,
    meanAbsMargin: mean(absMargins),
    marginSd: sd(margins),
    blowoutShare: share(absMargins, (m) => m >= BLOWOUT_MARGIN),
    closeShare: share(absMargins, (m) => m <= CLOSE_MARGIN),
    overtimeShare: share(finals, (game) => game.periodScores.length > 4),
    homeWinShare: share(margins, (m) => m > 0),
    homeEdge,
    residualMarginSd: sd(residuals),
    winPctSd: sd(winPcts),
    bestWinPct: Math.max(...winPcts),
    worstWinPct: Math.min(...winPcts),
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sd(values: readonly number[]): number {
  const average = mean(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      values.length,
  );
}

function share<T>(values: readonly T[], predicate: (value: T) => boolean) {
  return values.filter(predicate).length / values.length;
}
