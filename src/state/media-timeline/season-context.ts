import type { Game } from "@/domain/entities/game";
import type { GameState } from "@/state/game-state";

export type TeamRecord = { wins: number; losses: number };

/** Signed streak: +n = n straight wins, -n = n straight losses. */
export type StreakPair = { home: number; away: number };

/**
 * One pass over the current season's final games, shared by every detector
 * so the timeline build stays linear in the number of games.
 */
export type SeasonContext = {
  seasonId: string;
  seasonYear: number;
  /** Final league games (regular season, playoffs, All-Star), sorted (date, id). */
  games: Game[];
  /** Distinct dates of those games, ascending. */
  gameDays: string[];
  gameDayIndex: Map<string, number>;
  /** Regular-season record of each side before the game's date. */
  recordBefore: Map<string, { home: TeamRecord; away: TeamRecord }>;
  /** Regular-season streaks before and after each regular-season game. */
  streakBefore: Map<string, StreakPair>;
  streakAfter: Map<string, StreakPair>;
  /** League-wide single-game points high before the game's date. */
  seasonHighBefore: Map<string, number>;
  lastRegularSeasonDate: string | null;
};

const CONTEXT_COMPETITIONS = new Set<Game["competitionType"]>([
  "regular_season",
  "playoffs",
  "all_star",
]);

export function buildSeasonContext(state: GameState): SeasonContext {
  const seasonId = state.competition.season.id;
  const games = Object.values(state.competition.games)
    .filter(
      (game) =>
        game.status === "final" &&
        game.seasonId === seasonId &&
        CONTEXT_COMPETITIONS.has(game.competitionType),
    )
    .sort((a, b) =>
      a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? -1 : 1,
    );

  const gameDays: string[] = [];
  const gameDayIndex = new Map<string, number>();
  const recordBefore = new Map<
    string,
    { home: TeamRecord; away: TeamRecord }
  >();
  const streakBefore = new Map<string, StreakPair>();
  const streakAfter = new Map<string, StreakPair>();
  const seasonHighBefore = new Map<string, number>();
  const records = new Map<string, TeamRecord>();
  const streaks = new Map<string, number>();
  let seasonHigh = 0;
  let lastRegularSeasonDate: string | null = null;

  const recordOf = (teamId: string): TeamRecord => {
    const record = records.get(teamId);
    return record ? { ...record } : { wins: 0, losses: 0 };
  };

  let index = 0;
  while (index < games.length) {
    const date = games[index]!.date;
    gameDayIndex.set(date, gameDays.length);
    gameDays.push(date);
    let end = index;
    while (end < games.length && games[end]!.date === date) end += 1;
    const day = games.slice(index, end);

    // Records and highs are frozen for the whole day before any game applies.
    for (const game of day) {
      seasonHighBefore.set(game.id, seasonHigh);
      if (game.competitionType !== "regular_season") continue;
      recordBefore.set(game.id, {
        home: recordOf(game.homeTeamId),
        away: recordOf(game.awayTeamId),
      });
    }
    for (const game of day) {
      if (game.competitionType === "all_star") continue;
      for (const row of game.playerStats) {
        if (row.points > seasonHigh) seasonHigh = row.points;
      }
      if (game.competitionType !== "regular_season") continue;
      lastRegularSeasonDate = date;
      const homeWon = game.score.home > game.score.away;
      streakBefore.set(game.id, {
        home: streaks.get(game.homeTeamId) ?? 0,
        away: streaks.get(game.awayTeamId) ?? 0,
      });
      applyResult(records, streaks, game.homeTeamId, homeWon);
      applyResult(records, streaks, game.awayTeamId, !homeWon);
      streakAfter.set(game.id, {
        home: streaks.get(game.homeTeamId) ?? 0,
        away: streaks.get(game.awayTeamId) ?? 0,
      });
    }
    index = end;
  }

  return {
    seasonId,
    seasonYear: state.competition.season.year,
    games,
    gameDays,
    gameDayIndex,
    recordBefore,
    streakBefore,
    streakAfter,
    seasonHighBefore,
    lastRegularSeasonDate,
  };
}

function applyResult(
  records: Map<string, TeamRecord>,
  streaks: Map<string, number>,
  teamId: string,
  won: boolean,
): void {
  const record = records.get(teamId) ?? { wins: 0, losses: 0 };
  records.set(
    teamId,
    won
      ? { wins: record.wins + 1, losses: record.losses }
      : { wins: record.wins, losses: record.losses + 1 },
  );
  const streak = streaks.get(teamId) ?? 0;
  streaks.set(teamId, won ? Math.max(streak, 0) + 1 : Math.min(streak, 0) - 1);
}

export function winPct(record: TeamRecord): number | null {
  const played = record.wins + record.losses;
  return played === 0 ? null : record.wins / played;
}
