import type { Game } from "@/domain/entities/game";
import {
  createEmptyTeamStanding,
  type TeamStanding,
} from "@/domain/entities/standings";
import type { Team } from "@/domain/entities/team";
import type { GameId, SeasonId, TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

export type CalculateStandingsOptions = {
  seasonId?: SeasonId;
  gameOrderIds?: readonly GameId[];
};

type MutableStanding = {
  teamId: TeamId;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  conferenceWins: number;
  conferenceLosses: number;
  divisionWins: number;
  divisionLosses: number;
  results: Array<"W" | "L">;
};

function createMutableStanding(teamId: TeamId): MutableStanding {
  return {
    teamId,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    conferenceWins: 0,
    conferenceLosses: 0,
    divisionWins: 0,
    divisionLosses: 0,
    results: [],
  };
}

function compareGamesChronologically(
  left: Game,
  right: Game,
  orderIndexById: Map<string, number>,
): number {
  const dateCompare = left.date.localeCompare(right.date);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  const leftOrder = orderIndexById.get(left.id);
  const rightOrder = orderIndexById.get(right.id);
  const leftHasOrder = leftOrder !== undefined;
  const rightHasOrder = rightOrder !== undefined;
  if (leftHasOrder && rightHasOrder) {
    const orderCompare = leftOrder - rightOrder;
    if (orderCompare !== 0) {
      return orderCompare;
    }
  } else if (leftHasOrder !== rightHasOrder) {
    return leftHasOrder ? -1 : 1;
  }

  return left.id.localeCompare(right.id);
}

function finalizeStanding(mutable: MutableStanding): TeamStanding {
  const gamesPlayed = mutable.wins + mutable.losses;
  const winPercentage = gamesPlayed === 0 ? 0 : mutable.wins / gamesPlayed;

  let streakType: "W" | "L" | null = null;
  let streakCount = 0;
  if (mutable.results.length > 0) {
    const lastResult = mutable.results[mutable.results.length - 1]!;
    streakType = lastResult;
    for (let index = mutable.results.length - 1; index >= 0; index -= 1) {
      if (mutable.results[index] !== lastResult) {
        break;
      }
      streakCount += 1;
    }
  }

  return {
    teamId: mutable.teamId,
    wins: mutable.wins,
    losses: mutable.losses,
    winPercentage,
    pointsFor: mutable.pointsFor,
    pointsAgainst: mutable.pointsAgainst,
    pointDifferential: mutable.pointsFor - mutable.pointsAgainst,
    streak: { type: streakType, count: streakCount },
    conferenceWins: mutable.conferenceWins,
    conferenceLosses: mutable.conferenceLosses,
    divisionWins: mutable.divisionWins,
    divisionLosses: mutable.divisionLosses,
  };
}

function compareStandings(left: TeamStanding, right: TeamStanding): number {
  if (left.winPercentage !== right.winPercentage) {
    return right.winPercentage - left.winPercentage;
  }
  if (left.wins !== right.wins) {
    return right.wins - left.wins;
  }
  if (left.pointDifferential !== right.pointDifferential) {
    return right.pointDifferential - left.pointDifferential;
  }
  return left.teamId.localeCompare(right.teamId);
}

/** Deterministic standings order used for league ranks and playoff seeding. */
export { compareStandings };

/**
 * Pure, deterministic standings calculation from teams and completed games.
 * Does not mutate inputs or simulate games.
 */
export function calculateStandings(
  teams: readonly Team[],
  games: readonly Game[],
  options: CalculateStandingsOptions = {},
): TeamStanding[] {
  const teamById = new Map<string, Team>();
  const mutableByTeamId = new Map<string, MutableStanding>();

  for (const team of teams) {
    teamById.set(team.id, team);
    mutableByTeamId.set(team.id, createMutableStanding(team.id));
  }

  const orderIndexById = new Map<string, number>();
  const gameOrderIds = options.gameOrderIds ?? [];
  for (let index = 0; index < gameOrderIds.length; index += 1) {
    orderIndexById.set(gameOrderIds[index]!, index);
  }

  const countedGames: Game[] = [];
  for (const game of games) {
    if (game.status !== "final") {
      continue;
    }
    if (
      options.seasonId !== undefined &&
      game.seasonId !== options.seasonId
    ) {
      continue;
    }
    if (!teamById.has(game.homeTeamId) || !teamById.has(game.awayTeamId)) {
      continue;
    }
    if (game.score.home === game.score.away) {
      continue;
    }
    countedGames.push(game);
  }

  countedGames.sort((left, right) =>
    compareGamesChronologically(left, right, orderIndexById),
  );

  for (const game of countedGames) {
    const homeTeam = teamById.get(game.homeTeamId)!;
    const awayTeam = teamById.get(game.awayTeamId)!;
    const home = mutableByTeamId.get(game.homeTeamId)!;
    const away = mutableByTeamId.get(game.awayTeamId)!;

    const homeWon = game.score.home > game.score.away;
    const sameConference = homeTeam.conferenceId === awayTeam.conferenceId;
    const sameDivision = homeTeam.divisionId === awayTeam.divisionId;

    if (homeWon) {
      home.wins += 1;
      away.losses += 1;
      home.pointsFor += game.score.home;
      home.pointsAgainst += game.score.away;
      away.pointsFor += game.score.away;
      away.pointsAgainst += game.score.home;
      home.results.push("W");
      away.results.push("L");
      if (sameConference) {
        home.conferenceWins += 1;
        away.conferenceLosses += 1;
      }
      if (sameDivision) {
        home.divisionWins += 1;
        away.divisionLosses += 1;
      }
    } else {
      away.wins += 1;
      home.losses += 1;
      home.pointsFor += game.score.home;
      home.pointsAgainst += game.score.away;
      away.pointsFor += game.score.away;
      away.pointsAgainst += game.score.home;
      home.results.push("L");
      away.results.push("W");
      if (sameConference) {
        away.conferenceWins += 1;
        home.conferenceLosses += 1;
      }
      if (sameDivision) {
        away.divisionWins += 1;
        home.divisionLosses += 1;
      }
    }
  }

  const standings = [...mutableByTeamId.values()].map(finalizeStanding);
  standings.sort(compareStandings);
  return standings;
}

/**
 * Rebuilds standings from final regular-season games for the current season.
 * Only games listed in `schedule.gameIds` are counted so playoff games in
 * `competition.games` cannot rewrite regular-season W-L.
 * Replaces the entire byTeamId map (never merges with the previous cache).
 */
export function updateStandings(state: GameState): SystemResult {
  const regularSeasonGames = state.competition.schedule.gameIds
    .map((gameId) => state.competition.games[gameId])
    .filter((game): game is NonNullable<typeof game> => game != null);

  const entries = calculateStandings(
    Object.values(state.world.teams),
    regularSeasonGames,
    {
      seasonId: state.competition.season.id,
      gameOrderIds: state.competition.schedule.gameIds,
    },
  );

  const byTeamId: GameState["competition"]["standings"]["byTeamId"] = {};
  for (const entry of entries) {
    byTeamId[entry.teamId] = entry;
  }

  return systemResult({
    ...state,
    competition: {
      ...state.competition,
      standings: { byTeamId },
    },
  });
}

export { createEmptyTeamStanding };
