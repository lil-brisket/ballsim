/**
 * Daily Development League simulation pipeline.
 * Uses rosterOverrides — never mutates Team.roster.
 */

import type { DomainEvent } from "@/domain/events";
import type { Game } from "@/domain/entities/game";
import {
  createEmptyPlayerSeasonStatLine,
  type PlayerSeasonStatLine,
} from "@/domain/entities/player-history";
import {
  createEmptyTeamStanding,
  type TeamStanding,
} from "@/domain/entities/standings";
import { createPlayer } from "@/domain/entities/player";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { DL_MIN_ROSTER_FOR_GAME } from "@/systems/development-league/config";
import { getDevelopmentLeagueRosterPlayerIds } from "@/systems/development-league/franchise-membership";
import { simulateScheduledGame } from "@/systems/game-simulation";
import { processPostGameInjuryExposures } from "@/systems/injury/injury-post-game";
import { buildGameIdsByDate } from "@/systems/schedule-date-index";
import type { SimulationProfiler } from "@/systems/simulation/simulation-profiler";

export type DlDailyPipelineResult = SystemResult & {
  gamesSimulated: number;
};

function scheduledDlGameIdsForDate(state: GameState, date: string): string[] {
  const dl = state.competition.developmentLeague;
  if (dl == null) return [];
  let schedule = dl.schedule;
  if (
    schedule.gameIdsByDate == null ||
    Object.keys(schedule.gameIdsByDate).length === 0
  ) {
    schedule = {
      ...schedule,
      gameIdsByDate: buildGameIdsByDate(dl.games, schedule.gameIds),
    };
  }
  return schedule.gameIdsByDate?.[date] ?? [];
}

function buildDlRosterOverrides(
  state: GameState,
  homeTeamId: TeamId,
  awayTeamId: TeamId,
): Partial<Record<TeamId, PlayerId[]>> | null {
  const homeIds = getDevelopmentLeagueRosterPlayerIds(homeTeamId, state);
  const awayIds = getDevelopmentLeagueRosterPlayerIds(awayTeamId, state);
  if (
    homeIds.length < DL_MIN_ROSTER_FOR_GAME ||
    awayIds.length < DL_MIN_ROSTER_FOR_GAME
  ) {
    return null;
  }
  return {
    [homeTeamId]: homeIds,
    [awayTeamId]: awayIds,
  };
}

function applyDlGameToStandings(
  byTeamId: Record<string, TeamStanding>,
  game: Game,
): Record<string, TeamStanding> {
  const home =
    byTeamId[game.homeTeamId] ?? createEmptyTeamStanding(game.homeTeamId);
  const away =
    byTeamId[game.awayTeamId] ?? createEmptyTeamStanding(game.awayTeamId);
  const homeWon = game.score.home > game.score.away;
  const nextHome: TeamStanding = {
    ...home,
    wins: home.wins + (homeWon ? 1 : 0),
    losses: home.losses + (homeWon ? 0 : 1),
    pointsFor: home.pointsFor + game.score.home,
    pointsAgainst: home.pointsAgainst + game.score.away,
    pointDifferential:
      home.pointsFor +
      game.score.home -
      (home.pointsAgainst + game.score.away),
    winPercentage: 0,
    streak: {
      type: homeWon ? "W" : "L",
      count:
        home.streak.type === (homeWon ? "W" : "L") ? home.streak.count + 1 : 1,
    },
  };
  const nextAway: TeamStanding = {
    ...away,
    wins: away.wins + (homeWon ? 0 : 1),
    losses: away.losses + (homeWon ? 1 : 0),
    pointsFor: away.pointsFor + game.score.away,
    pointsAgainst: away.pointsAgainst + game.score.home,
    pointDifferential:
      away.pointsFor +
      game.score.away -
      (away.pointsAgainst + game.score.home),
    winPercentage: 0,
    streak: {
      type: homeWon ? "L" : "W",
      count:
        away.streak.type === (homeWon ? "L" : "W") ? away.streak.count + 1 : 1,
    },
  };
  const homeGames = nextHome.wins + nextHome.losses;
  const awayGames = nextAway.wins + nextAway.losses;
  nextHome.winPercentage = homeGames === 0 ? 0 : nextHome.wins / homeGames;
  nextAway.winPercentage = awayGames === 0 ? 0 : nextAway.wins / awayGames;
  return {
    ...byTeamId,
    [game.homeTeamId]: nextHome,
    [game.awayTeamId]: nextAway,
  };
}

function accumulateFromGame(
  line: PlayerSeasonStatLine,
  game: Game,
  playerId: PlayerId,
): PlayerSeasonStatLine {
  const row = game.playerStats.find((s) => s.playerId === playerId);
  if (row == null) return line;
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

/**
 * Rebuild currentSeasonStats cache from all finalized DL games this season.
 */
export function rebuildDlSeasonStatsCache(state: GameState): GameState {
  const dl = state.competition.developmentLeague;
  if (dl == null) return state;
  const seasonId = state.competition.season.id;
  const totals = new Map<string, PlayerSeasonStatLine>();

  for (const game of Object.values(dl.games)) {
    if (game.status !== "final" || game.seasonId !== seasonId) continue;
    for (const row of game.playerStats) {
      const prior =
        totals.get(row.playerId) ?? createEmptyPlayerSeasonStatLine();
      totals.set(
        row.playerId,
        accumulateFromGame(prior, game, row.playerId as PlayerId),
      );
    }
  }

  if (totals.size === 0) return state;

  const players = { ...state.world.players };
  let changed = false;
  for (const [playerId, stats] of totals) {
    const player = players[playerId];
    if (player == null) continue;
    const profile =
      player.developmentLeague ??
      ({
        status: "none" as const,
        parentTeamId: null,
        role: "development" as const,
        seasonsUsed: 0,
        assignedThisSeason: false,
        dlAssignmentLockedThisSeason: false,
        firstAssignedSeasonYear: null,
        draftSeasonYear: null,
      });
    players[playerId] = createPlayer({
      ...player,
      developmentLeague: {
        ...profile,
        currentSeasonStats: stats,
      },
    });
    changed = true;
  }
  if (!changed) return state;
  return {
    ...state,
    world: { ...state.world, players },
  };
}

/**
 * Simulate scheduled DL games for the current calendar date.
 */
export function runDevelopmentLeaguePipeline(
  state: GameState,
  rng: Rng,
  profiler?: SimulationProfiler,
): DlDailyPipelineResult {
  const events: DomainEvent[] = [];
  let current = state;
  let gamesSimulated = 0;
  const date = current.world.calendar.currentDate;
  const dl = current.competition.developmentLeague;
  if (dl == null) {
    return { ...systemResult(current), gamesSimulated: 0 };
  }

  const gameIds = scheduledDlGameIdsForDate(current, date);
  if (gameIds.length === 0) {
    return { ...systemResult(current), gamesSimulated: 0 };
  }

  const games = { ...dl.games };
  let byTeamId = { ...dl.standings.byTeamId };
  const newlyFinalized: Game[] = [];

  for (const gameId of gameIds) {
    const game = games[gameId];
    if (game == null || game.status !== "scheduled") continue;

    const overrides = buildDlRosterOverrides(
      current,
      game.homeTeamId,
      game.awayTeamId,
    );
    if (overrides == null) {
      continue;
    }

    const gameStart = performance.now();
    const { finalGame, event } = simulateScheduledGame(current, game, rng, {
      profiler,
      rosterOverrides: overrides,
    });
    if (profiler) {
      profiler.addSeason("gameSimMs", performance.now() - gameStart);
    }
    games[gameId] = finalGame;
    events.push(event);
    newlyFinalized.push(finalGame);
    byTeamId = applyDlGameToStandings(byTeamId, finalGame);
    gamesSimulated += 1;
  }

  if (gamesSimulated === 0) {
    return { ...systemResult(current), gamesSimulated: 0 };
  }

  current = {
    ...current,
    competition: {
      ...current.competition,
      developmentLeague: {
        ...dl,
        games,
        standings: { byTeamId },
      },
    },
  };

  for (const game of newlyFinalized) {
    const injuryResult = processPostGameInjuryExposures(current, game, rng);
    current = injuryResult.state;
    events.push(...injuryResult.events);
  }

  current = rebuildDlSeasonStatsCache(current);

  return {
    ...systemResult(current, events),
    gamesSimulated,
  };
}
