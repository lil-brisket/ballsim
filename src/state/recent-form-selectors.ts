/**
 * Shared recent-form definition: last 5 completed team games.
 * Use this everywhere (Front Office, Team Hub, Next Game) — do not recompute
 * with different windows per screen.
 */

import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";

export const RECENT_FORM_GAME_LIMIT = 5;

export type RecentFormGame = {
  gameId: string;
  date: string;
  opponentAbbreviation: string;
  opponentTeamId: string;
  opponentBranding: TeamBrandingView | null;
  home: boolean;
  teamScore: number;
  opponentScore: number;
  won: boolean;
};

export type RecentFormView = {
  games: RecentFormGame[];
  /** e.g. "W3 L2" for the window */
  record: string;
  /** e.g. "W3" / "L2" or null when no games */
  streak: string | null;
  /** Compact W/L marks e.g. "WWLWL" */
  marks: string;
};

function computeStreak(games: RecentFormGame[]): string | null {
  if (games.length === 0) return null;
  // games are newest-first
  const first = games[0]!;
  let count = 0;
  for (const game of games) {
    if (game.won !== first.won) break;
    count += 1;
  }
  return `${first.won ? "W" : "L"}${count}`;
}

/**
 * Recent form = last 5 completed games for the team (newest first).
 */
export function getRecentForm(
  state: GameState,
  teamId: TeamId,
  limit: number = RECENT_FORM_GAME_LIMIT,
): RecentFormView {
  const games = Object.values(state.competition.games)
    .filter(
      (game) =>
        game.status === "final" &&
        (game.homeTeamId === teamId || game.awayTeamId === teamId),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((game) => {
      const home = game.homeTeamId === teamId;
      const teamScore = home ? game.score.home : game.score.away;
      const opponentScore = home ? game.score.away : game.score.home;
      const opponentId = home ? game.awayTeamId : game.homeTeamId;
      const opponent = state.world.teams[opponentId];
      return {
        gameId: game.id,
        date: game.date,
        opponentAbbreviation: opponent?.abbreviation ?? "???",
        opponentTeamId: opponentId,
        opponentBranding: toBrandingView(opponent?.branding) ?? null,
        home,
        teamScore,
        opponentScore,
        won: teamScore > opponentScore,
      } satisfies RecentFormGame;
    });

  const wins = games.filter((g) => g.won).length;
  const losses = games.length - wins;
  const marks = games.map((g) => (g.won ? "W" : "L")).join("");

  return {
    games,
    record: games.length === 0 ? "—" : `${wins}–${losses}`,
    streak: computeStreak(games),
    marks,
  };
}

/** Build a RecentFormView from already-projected dashboard recentResults. */
export function recentFormFromResults(
  results: Array<{
    gameId: string;
    date: string;
    opponentAbbreviation: string;
    home: boolean;
    teamScore: number;
    opponentScore: number;
    won: boolean;
    opponentBranding?: TeamBrandingView | null;
    opponentTeamId?: string;
  }>,
): RecentFormView {
  const games: RecentFormGame[] = results
    .slice(0, RECENT_FORM_GAME_LIMIT)
    .map((result) => ({
      gameId: result.gameId,
      date: result.date,
      opponentAbbreviation: result.opponentAbbreviation,
      opponentTeamId: result.opponentTeamId ?? "",
      opponentBranding: result.opponentBranding ?? null,
      home: result.home,
      teamScore: result.teamScore,
      opponentScore: result.opponentScore,
      won: result.won,
    }));

  const wins = games.filter((g) => g.won).length;
  const losses = games.length - wins;

  return {
    games,
    record: games.length === 0 ? "—" : `${wins}–${losses}`,
    streak: computeStreak(games),
    marks: games.map((g) => (g.won ? "W" : "L")).join(""),
  };
}
