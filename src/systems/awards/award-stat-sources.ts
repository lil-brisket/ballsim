import type { Game, GamePlayerStats } from "@/domain/entities/game";
import {
  createEmptyPlayerSeasonStatLine,
  type PlayerSeasonStatLine,
} from "@/domain/entities/player-history";
import type { PlayerId, SeasonId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getAllFinalGames } from "@/state/game-access";

export type PeriodPlayerAgg = {
  playerId: PlayerId;
  teamId: TeamId | null;
  games: number;
  starts: number;
  minutes: number;
  totals: PlayerSeasonStatLine;
};

export type PeriodTeamRecord = {
  teamId: TeamId;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
};

/** Primary-league final games only — never development_league. */
export function getPrimaryLeagueFinalGames(
  state: GameState,
  options?: {
    seasonId?: SeasonId;
    competitionTypes?: ReadonlyArray<"regular_season" | "playoffs">;
  },
): Game[] {
  const seasonId = options?.seasonId ?? state.competition.season.id;
  const types = new Set(
    options?.competitionTypes ?? (["regular_season"] as const),
  );
  return getAllFinalGames(state).filter(
    (game) =>
      game.seasonId === seasonId &&
      game.competitionType !== "development_league" &&
      types.has(game.competitionType as "regular_season" | "playoffs"),
  );
}

/** Regular-season primary games in a calendar month (YYYY-MM). */
export function getPrimaryGamesForMonth(
  state: GameState,
  monthId: string,
  seasonId?: SeasonId,
): Game[] {
  return getPrimaryLeagueFinalGames(state, {
    seasonId,
    competitionTypes: ["regular_season"],
  }).filter((game) => game.date.startsWith(monthId));
}

export function getPlayerTeamAtGame(
  game: Game,
  playerId: PlayerId,
): TeamId | null {
  const row = game.playerStats.find((stat) => stat.playerId === playerId);
  if (!row) return null;
  return row.teamId;
}

function accumulateRow(
  line: PlayerSeasonStatLine,
  row: GamePlayerStats,
): PlayerSeasonStatLine {
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
  };
}

export function aggregatePlayerPeriodStats(
  playerId: PlayerId,
  games: readonly Game[],
): PeriodPlayerAgg {
  let totals = createEmptyPlayerSeasonStatLine();
  let starts = 0;
  let teamId: TeamId | null = null;
  let teamGames = new Map<string, number>();

  for (const game of games) {
    const row = game.playerStats.find((stat) => stat.playerId === playerId);
    if (!row) continue;
    totals = accumulateRow(totals, row);
    if (row.started === true) {
      starts += 1;
    }
    if (row.teamId) {
      teamGames.set(row.teamId, (teamGames.get(row.teamId) ?? 0) + 1);
    }
  }

  let bestCount = 0;
  for (const [id, count] of teamGames) {
    if (count > bestCount) {
      bestCount = count;
      teamId = id as TeamId;
    }
  }

  return {
    playerId,
    teamId,
    games: totals.games,
    starts,
    minutes: totals.minutes,
    totals,
  };
}

export function listPlayersInGames(games: readonly Game[]): PlayerId[] {
  const ids = new Set<string>();
  for (const game of games) {
    for (const row of game.playerStats) {
      if (row.minutes > 0 || row.points > 0) {
        ids.add(row.playerId);
      }
    }
  }
  return [...ids].sort() as PlayerId[];
}

export function aggregateTeamPeriodRecords(
  games: readonly Game[],
): Map<string, PeriodTeamRecord> {
  const byTeam = new Map<string, PeriodTeamRecord>();

  function ensure(teamId: string): PeriodTeamRecord {
    let row = byTeam.get(teamId);
    if (!row) {
      row = {
        teamId: teamId as TeamId,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
      byTeam.set(teamId, row);
    }
    return row;
  }

  for (const game of games) {
    if (game.status !== "final") continue;
    const home = ensure(game.homeTeamId);
    const away = ensure(game.awayTeamId);
    home.pointsFor += game.score.home;
    home.pointsAgainst += game.score.away;
    away.pointsFor += game.score.away;
    away.pointsAgainst += game.score.home;
    if (game.score.home > game.score.away) {
      home.wins += 1;
      away.losses += 1;
    } else if (game.score.away > game.score.home) {
      away.wins += 1;
      home.losses += 1;
    }
  }

  return byTeam;
}

export function teamWinPct(record: PeriodTeamRecord): number {
  const gp = record.wins + record.losses;
  return gp === 0 ? 0 : record.wins / gp;
}

export function rankTeamsByWinPct(
  records: Map<string, PeriodTeamRecord>,
): Map<string, number> {
  const sorted = [...records.values()].sort((a, b) => {
    const winDiff = teamWinPct(b) - teamWinPct(a);
    if (winDiff !== 0) return winDiff;
    return a.teamId.localeCompare(b.teamId);
  });
  const ranks = new Map<string, number>();
  sorted.forEach((row, index) => {
    ranks.set(row.teamId, index + 1);
  });
  return ranks;
}

export function rankTeamsByPointsAgainst(
  records: Map<string, PeriodTeamRecord>,
): Map<string, number> {
  const sorted = [...records.values()].sort((a, b) => {
    const aGp = a.wins + a.losses;
    const bGp = b.wins + b.losses;
    const aPa = aGp === 0 ? 999 : a.pointsAgainst / aGp;
    const bPa = bGp === 0 ? 999 : b.pointsAgainst / bGp;
    if (aPa !== bPa) return aPa - bPa;
    return a.teamId.localeCompare(b.teamId);
  });
  const ranks = new Map<string, number>();
  sorted.forEach((row, index) => {
    ranks.set(row.teamId, index + 1);
  });
  return ranks;
}
