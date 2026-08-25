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
    applyFinalGameToMutable(
      game,
      teamById.get(game.homeTeamId)!,
      teamById.get(game.awayTeamId)!,
      mutableByTeamId.get(game.homeTeamId)!,
      mutableByTeamId.get(game.awayTeamId)!,
    );
  }

  const standings = [...mutableByTeamId.values()].map(finalizeStanding);
  standings.sort(compareStandings);
  return standings;
}

function applyFinalGameToMutable(
  game: Game,
  homeTeam: Team,
  awayTeam: Team,
  home: MutableStanding,
  away: MutableStanding,
): void {
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

function standingFromPartial(
  previous: TeamStanding | undefined,
  teamId: TeamId,
): TeamStanding {
  return previous ?? createEmptyTeamStanding(teamId);
}

function applyResultToStanding(
  standing: TeamStanding,
  won: boolean,
  pointsFor: number,
  pointsAgainst: number,
  conference: boolean,
  division: boolean,
): TeamStanding {
  const wins = standing.wins + (won ? 1 : 0);
  const losses = standing.losses + (won ? 0 : 1);
  const gamesPlayed = wins + losses;
  const result: "W" | "L" = won ? "W" : "L";
  let streakType = standing.streak.type;
  let streakCount = standing.streak.count;
  if (streakType === result) {
    streakCount += 1;
  } else {
    streakType = result;
    streakCount = 1;
  }
  const nextPointsFor = standing.pointsFor + pointsFor;
  const nextPointsAgainst = standing.pointsAgainst + pointsAgainst;
  return {
    teamId: standing.teamId,
    wins,
    losses,
    winPercentage: gamesPlayed === 0 ? 0 : wins / gamesPlayed,
    pointsFor: nextPointsFor,
    pointsAgainst: nextPointsAgainst,
    pointDifferential: nextPointsFor - nextPointsAgainst,
    streak: { type: streakType, count: streakCount },
    conferenceWins: standing.conferenceWins + (won && conference ? 1 : 0),
    conferenceLosses: standing.conferenceLosses + (!won && conference ? 1 : 0),
    divisionWins: standing.divisionWins + (won && division ? 1 : 0),
    divisionLosses: standing.divisionLosses + (!won && division ? 1 : 0),
  };
}

/**
 * Applies one finalized regular-season game into existing standings (hot path).
 * Callers must ensure games are applied in chronological schedule order.
 */
export function applyFinalGameToStandings(
  byTeamId: Record<string, TeamStanding>,
  game: Game,
  homeTeam: Team,
  awayTeam: Team,
): Record<string, TeamStanding> {
  if (game.status !== "final" || game.score.home === game.score.away) {
    return byTeamId;
  }

  const homeWon = game.score.home > game.score.away;
  const sameConference = homeTeam.conferenceId === awayTeam.conferenceId;
  const sameDivision = homeTeam.divisionId === awayTeam.divisionId;

  const home = applyResultToStanding(
    standingFromPartial(byTeamId[game.homeTeamId], game.homeTeamId),
    homeWon,
    game.score.home,
    game.score.away,
    sameConference,
    sameDivision,
  );
  const away = applyResultToStanding(
    standingFromPartial(byTeamId[game.awayTeamId], game.awayTeamId),
    !homeWon,
    game.score.away,
    game.score.home,
    sameConference,
    sameDivision,
  );

  return {
    ...byTeamId,
    [game.homeTeamId]: home,
    [game.awayTeamId]: away,
  };
}

/**
 * Full standings rebuild from schedule games (migration / debug / integrity).
 * Only games listed in `schedule.gameIds` are counted so playoff games in
 * `competition.games` cannot rewrite regular-season W-L.
 */
export function rebuildStandings(state: GameState): SystemResult {
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

  // Ensure every team has a row even with zero games.
  for (const team of Object.values(state.world.teams)) {
    if (byTeamId[team.id] == null) {
      byTeamId[team.id] = createEmptyTeamStanding(team.id);
    }
  }

  return systemResult({
    ...state,
    competition: {
      ...state.competition,
      standings: { byTeamId },
    },
  });
}

/**
 * Incremental standings update from newly finalized regular-season games.
 * Falls back to {@link rebuildStandings} when no prior standings exist.
 */
export function updateStandingsIncremental(
  state: GameState,
  newlyFinalizedGames: readonly Game[],
): SystemResult {
  if (newlyFinalizedGames.length === 0) {
    return systemResult(state);
  }

  const existing = state.competition.standings.byTeamId;
  const teamCount = Object.keys(state.world.teams).length;
  const standingCount = Object.keys(existing).length;
  if (standingCount === 0 && teamCount > 0) {
    // Seed empty rows so incremental apply has a baseline for all teams.
    let seeded = state;
    const byTeamId: Record<string, TeamStanding> = {};
    for (const team of Object.values(state.world.teams)) {
      byTeamId[team.id] = createEmptyTeamStanding(team.id);
    }
    seeded = {
      ...state,
      competition: {
        ...state.competition,
        standings: { byTeamId },
      },
    };
    return updateStandingsIncremental(seeded, newlyFinalizedGames);
  }

  let byTeamId = { ...existing };
  for (const game of newlyFinalizedGames) {
    if (game.competitionType !== "regular_season") {
      continue;
    }
    if (!state.competition.schedule.gameIds.includes(game.id)) {
      continue;
    }
    const homeTeam = state.world.teams[game.homeTeamId];
    const awayTeam = state.world.teams[game.awayTeamId];
    if (homeTeam == null || awayTeam == null) {
      continue;
    }
    byTeamId = applyFinalGameToStandings(byTeamId, game, homeTeam, awayTeam);
  }

  return systemResult({
    ...state,
    competition: {
      ...state.competition,
      standings: { byTeamId },
    },
  });
}

/**
 * Hot-path standings update. Prefer incremental application of newly
 * finalized games; use {@link rebuildStandings} for full correctness rebuilds.
 */
export function updateStandings(
  state: GameState,
  newlyFinalizedGames?: readonly Game[],
): SystemResult {
  if (newlyFinalizedGames !== undefined) {
    return updateStandingsIncremental(state, newlyFinalizedGames);
  }
  return rebuildStandings(state);
}

export { createEmptyTeamStanding };
