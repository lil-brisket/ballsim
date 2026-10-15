import type {
  Game,
  GameCompetitionType,
  GamePlayerStats,
} from "@/domain/entities/game";
import type { PlayerSeasonStatLine } from "@/domain/entities/player-history";
import type { PlayerId } from "@/domain/ids";

/**
 * Single authority for which games count toward a player's statistics and
 * how box-score rows are summed. Season lines, career lines, the player card
 * and season-end snapshots all classify games through here.
 *
 * Counted: regular season and playoffs (top league), development league
 * (own bucket, never mixed into combined). Not counted: preseason, All-Star
 * and midseason tournament games — they stay in the game log only.
 */

export type PlayerStatBucket = "regular" | "playoffs" | "development";

export function classifyCompetition(
  type: GameCompetitionType,
): PlayerStatBucket | null {
  switch (type) {
    case "regular_season":
      return "regular";
    case "playoffs":
      return "playoffs";
    case "development_league":
      return "development";
    case "preseason":
    case "all_star":
    case "midseason_tournament":
      return null;
  }
}

/** True for games that count toward top-league (regular + playoff) stats. */
export function isTopLeagueStatGame(game: Game): boolean {
  const bucket = classifyCompetition(game.competitionType);
  return bucket === "regular" || bucket === "playoffs";
}

/**
 * Display-side stat line: the persisted season line plus box-score columns
 * that season-end snapshots do not store. Derived from games only; never
 * written into saved state.
 */
export type PlayerStatLine = PlayerSeasonStatLine & {
  gamesStarted: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  fouls: number;
  doubleDoubles: number;
  tripleDoubles: number;
};

export type PlayerStatBuckets = {
  regular: PlayerStatLine;
  playoffs: PlayerStatLine;
  development: PlayerStatLine;
  /** Top league only (regular + playoffs). Never includes development. */
  combined: PlayerStatLine;
};

export function createEmptyPlayerStatLine(): PlayerStatLine {
  return {
    games: 0,
    minutes: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fgMade: 0,
    fgAttempted: 0,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
    gamesStarted: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    fouls: 0,
    doubleDoubles: 0,
    tripleDoubles: 0,
  };
}

/** Counts of points, rebounds, assists, steals and blocks at 10 or more. */
function doubleDigitCategories(row: GamePlayerStats): number {
  return [row.points, row.rebounds, row.assists, row.steals, row.blocks].filter(
    (value) => value >= 10,
  ).length;
}

export function accumulatePlayerStatLine(
  line: PlayerStatLine,
  row: GamePlayerStats,
): PlayerStatLine {
  const doubleDigits = doubleDigitCategories(row);
  return {
    games: line.games + 1,
    minutes: line.minutes + row.minutes,
    points: line.points + row.points,
    rebounds: line.rebounds + row.rebounds,
    assists: line.assists + row.assists,
    steals: line.steals + row.steals,
    blocks: line.blocks + row.blocks,
    turnovers: line.turnovers + row.turnovers,
    fgMade: line.fgMade + row.fieldGoalsMade,
    fgAttempted: line.fgAttempted + row.fieldGoalsAttempted,
    threeMade: line.threeMade + row.threePointersMade,
    threeAttempted: line.threeAttempted + row.threePointersAttempted,
    ftMade: line.ftMade + row.freeThrowsMade,
    ftAttempted: line.ftAttempted + row.freeThrowsAttempted,
    gamesStarted: line.gamesStarted + (row.started ? 1 : 0),
    offensiveRebounds: line.offensiveRebounds + row.offensiveRebounds,
    defensiveRebounds: line.defensiveRebounds + row.defensiveRebounds,
    fouls: line.fouls + row.fouls,
    doubleDoubles: line.doubleDoubles + (doubleDigits >= 2 ? 1 : 0),
    tripleDoubles: line.tripleDoubles + (doubleDigits >= 3 ? 1 : 0),
  };
}

export function addPlayerStatLines(
  a: PlayerStatLine,
  b: PlayerStatLine,
): PlayerStatLine {
  return {
    games: a.games + b.games,
    minutes: a.minutes + b.minutes,
    points: a.points + b.points,
    rebounds: a.rebounds + b.rebounds,
    assists: a.assists + b.assists,
    steals: a.steals + b.steals,
    blocks: a.blocks + b.blocks,
    turnovers: a.turnovers + b.turnovers,
    fgMade: a.fgMade + b.fgMade,
    fgAttempted: a.fgAttempted + b.fgAttempted,
    threeMade: a.threeMade + b.threeMade,
    threeAttempted: a.threeAttempted + b.threeAttempted,
    ftMade: a.ftMade + b.ftMade,
    ftAttempted: a.ftAttempted + b.ftAttempted,
    gamesStarted: a.gamesStarted + b.gamesStarted,
    offensiveRebounds: a.offensiveRebounds + b.offensiveRebounds,
    defensiveRebounds: a.defensiveRebounds + b.defensiveRebounds,
    fouls: a.fouls + b.fouls,
    doubleDoubles: a.doubleDoubles + b.doubleDoubles,
    tripleDoubles: a.tripleDoubles + b.tripleDoubles,
  };
}

/** Narrows a display line to the persisted season-snapshot shape. */
export function toPlayerSeasonStatLine(
  line: PlayerStatLine,
): PlayerSeasonStatLine {
  return {
    games: line.games,
    minutes: line.minutes,
    points: line.points,
    rebounds: line.rebounds,
    assists: line.assists,
    steals: line.steals,
    blocks: line.blocks,
    turnovers: line.turnovers,
    fgMade: line.fgMade,
    fgAttempted: line.fgAttempted,
    threeMade: line.threeMade,
    threeAttempted: line.threeAttempted,
    ftMade: line.ftMade,
    ftAttempted: line.ftAttempted,
  };
}

/**
 * Sums one player's rows across games into competition buckets.
 * Callers pass finalized games, deduped by gameId (see state/game-access).
 */
export function aggregatePlayerGames(
  games: readonly Game[],
  playerId: PlayerId,
): PlayerStatBuckets {
  let regular = createEmptyPlayerStatLine();
  let playoffs = createEmptyPlayerStatLine();
  let development = createEmptyPlayerStatLine();

  for (const game of games) {
    const bucket = classifyCompetition(game.competitionType);
    if (bucket === null) continue;
    const row = game.playerStats.find((stat) => stat.playerId === playerId);
    if (!row) continue;
    if (bucket === "regular") {
      regular = accumulatePlayerStatLine(regular, row);
    } else if (bucket === "playoffs") {
      playoffs = accumulatePlayerStatLine(playoffs, row);
    } else {
      development = accumulatePlayerStatLine(development, row);
    }
  }

  return {
    regular,
    playoffs,
    development,
    combined: addPlayerStatLines(regular, playoffs),
  };
}
