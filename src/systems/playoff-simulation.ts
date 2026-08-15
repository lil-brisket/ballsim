import type { DomainEvent } from "@/domain/events";
import type {
  PlayoffSeries,
  PlayoffTournament,
} from "@/domain/entities/playoffs";
import type { SeriesLength } from "@/domain/game-settings";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { generateBracket } from "@/systems/playoff-bracket";
import {
  applyPlayInResults,
  playInMatchups,
  qualifyAndSeed,
} from "@/systems/playoff-qualification";
import {
  createNextPlayoffGame,
  nextPlayoffGameDate,
} from "@/systems/playoff-scheduling";
import { recordSeriesGameResult } from "@/systems/playoff-series";
import { simulateScheduledGame } from "@/systems/game-simulation";
import { asGameId, asTeamId, type TeamId } from "@/domain/ids";
import { createGame } from "@/domain/entities/game";

/**
 * Qualifies teams and builds the playoff bracket from settings.
 * Does not mutate season.phase — callers use transitionPhase("playoffs").
 * Idempotent when playoffs are already in_progress or complete.
 *
 * Play-in (when enabled): resolves both bubble games deterministically via RNG
 * in this call, then builds the N-team bracket. No fake bye series.
 */
export function startPlayoffs(state: GameState, rng?: Rng): SystemResult {
  const playoffs = state.competition.playoffs;
  if (playoffs.status === "complete" || playoffs.status === "in_progress") {
    return systemResult(state);
  }

  const playoffTeams = state.settings.playoffs.playoffTeams;
  const standings = Object.values(state.competition.standings.byTeamId);
  const liveTeamCount = Object.keys(state.world.teams).length;
  if (playoffTeams > liveTeamCount) {
    throw new Error(
      `startPlayoffs playoffTeams (${playoffTeams}) exceeds live team count (${liveTeamCount}).`,
    );
  }

  let qualified;
  let current = state;
  const events: DomainEvent[] = [];

  if (state.settings.playoffs.playInEnabled) {
    if (!rng) {
      throw new Error("startPlayoffs with play-in requires an Rng.");
    }
    const matchups = playInMatchups(standings, playoffTeams);
    const playIn = simulatePlayInGames(current, matchups, rng);
    current = playIn.state;
    events.push(...playIn.events);
    qualified = applyPlayInResults(
      standings,
      playoffTeams,
      playIn.gameAWinner,
      playIn.gameBWinner,
    );
  } else {
    qualified = qualifyAndSeed(standings, playoffTeams);
  }

  const tournament = generateBracket(qualified);

  return systemResult(
    {
      ...current,
      competition: {
        ...current.competition,
        playoffs: tournament,
      },
    },
    events,
  );
}

function simulatePlayInGames(
  state: GameState,
  matchups: ReturnType<typeof playInMatchups>,
  rng: Rng,
): {
  state: GameState;
  events: DomainEvent[];
  gameAWinner: TeamId;
  gameBWinner: TeamId;
} {
  const events: DomainEvent[] = [];
  let current = state;
  let games = { ...current.competition.games };

  const date = current.world.calendar.currentDate;
  const seasonId = current.competition.season.id;

  const gameA = createGame({
    id: asGameId(`playin_a_${seasonId}`),
    seasonId,
    date,
    homeTeamId: matchups.gameA.homeTeamId,
    awayTeamId: matchups.gameA.awayTeamId,
    status: "scheduled",
    score: { home: 0, away: 0 },
    periodScores: [],
    events: [],
    playerStats: [],
  });
  const gameB = createGame({
    id: asGameId(`playin_b_${seasonId}`),
    seasonId,
    date,
    homeTeamId: matchups.gameB.homeTeamId,
    awayTeamId: matchups.gameB.awayTeamId,
    status: "scheduled",
    score: { home: 0, away: 0 },
    periodScores: [],
    events: [],
    playerStats: [],
  });

  games[gameA.id] = gameA;
  games[gameB.id] = gameB;
  current = {
    ...current,
    competition: { ...current.competition, games },
  };

  const simA = simulateScheduledGame(current, gameA, rng);
  games = { ...games, [simA.finalGame.id]: simA.finalGame };
  current = { ...current, competition: { ...current.competition, games } };
  events.push(simA.event);

  const simB = simulateScheduledGame(current, gameB, rng);
  games = { ...games, [simB.finalGame.id]: simB.finalGame };
  current = { ...current, competition: { ...current.competition, games } };
  events.push(simB.event);

  const gameAWinner =
    simA.finalGame.score.home > simA.finalGame.score.away
      ? simA.finalGame.homeTeamId
      : simA.finalGame.awayTeamId;
  const gameBWinner =
    simB.finalGame.score.home > simB.finalGame.score.away
      ? simB.finalGame.homeTeamId
      : simB.finalGame.awayTeamId;

  return {
    state: current,
    events,
    gameAWinner: asTeamId(gameAWinner),
    gameBWinner: asTeamId(gameBWinner),
  };
}

/**
 * Schedules and simulates the next required playoff game (one series game).
 * Advances winners into later rounds; sets champion when the final completes.
 * No-op when the tournament is already complete.
 */
export function simulateNextPlayoffGame(
  state: GameState,
  rng: Rng,
): SystemResult {
  const playoffs = state.competition.playoffs;
  if (playoffs.status === "not_started") {
    throw new Error(
      "simulateNextPlayoffGame requires playoffs to be started.",
    );
  }
  if (playoffs.status === "complete") {
    return systemResult(state);
  }

  const seriesLength = state.settings.playoffs.seriesLength;
  const seriesList = playoffs.series.map((series) => ({ ...series }));
  fillReadySeries(seriesList, playoffs);

  const nextSeries = pickNextActiveSeries(seriesList);
  if (!nextSeries) {
    throw new Error(
      "simulateNextPlayoffGame: no active series ready to play.",
    );
  }

  const nextDate = nextPlayoffGameDate({
    calendarCurrentDate: state.world.calendar.currentDate,
    games: state.competition.games,
  });

  const scheduled = createNextPlayoffGame({
    series: nextSeries,
    seasonId: state.competition.season.id,
    nextDate,
    seriesLength,
  });

  const games = {
    ...state.competition.games,
    [scheduled.id]: scheduled,
  };

  const stateWithGame: GameState = {
    ...state,
    competition: {
      ...state.competition,
      games,
      playoffs: {
        ...playoffs,
        series: seriesList,
      },
    },
  };

  const { finalGame, event } = simulateScheduledGame(
    stateWithGame,
    scheduled,
    rng,
  );
  games[scheduled.id] = finalGame;

  const winnerTeamId =
    finalGame.score.home > finalGame.score.away
      ? finalGame.homeTeamId
      : finalGame.awayTeamId;

  const seriesIndex = seriesList.findIndex(
    (series) => series.id === nextSeries.id,
  );
  const updatedSeries = recordSeriesGameResult(
    seriesList[seriesIndex]!,
    finalGame.id,
    winnerTeamId,
    seriesLength,
  );
  seriesList[seriesIndex] = updatedSeries;

  fillReadySeries(seriesList, playoffs);

  const finalRound = Math.max(...seriesList.map((s) => s.round));
  const finalSeries = seriesList.find(
    (series) => series.round === finalRound && series.slot === 0,
  );
  const tournamentComplete =
    finalSeries?.status === "complete" && finalSeries.winnerTeamId != null;

  const nextPlayoffs: PlayoffTournament = {
    ...playoffs,
    series: seriesList,
    status: tournamentComplete ? "complete" : "in_progress",
    championTeamId: tournamentComplete
      ? finalSeries!.winnerTeamId
      : playoffs.championTeamId,
  };

  const events: DomainEvent[] = [event];

  return systemResult(
    {
      ...state,
      competition: {
        ...state.competition,
        games,
        playoffs: nextPlayoffs,
      },
    },
    events,
  );
}

/**
 * Simulates the entire playoff tournament to completion.
 */
export function simulatePlayoffs(state: GameState, rng: Rng): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;

  if (current.competition.playoffs.status === "not_started") {
    const started = startPlayoffs(current, rng);
    current = started.state;
    events.push(...started.events);
  }

  let guard = 0;
  const seriesLength = current.settings.playoffs.seriesLength;
  const maxGames =
    current.competition.playoffs.series.length * seriesLength ||
    Number.MAX_SAFE_INTEGER;

  while (current.competition.playoffs.status !== "complete") {
    guard += 1;
    if (guard > maxGames) {
      throw new Error(
        "simulatePlayoffs exceeded maximum expected playoff games.",
      );
    }
    const step = simulateNextPlayoffGame(current, rng);
    current = step.state;
    events.push(...step.events);
  }

  return systemResult(current, events);
}

function pickNextActiveSeries(seriesList: PlayoffSeries[]): PlayoffSeries | null {
  const active = seriesList
    .filter((series) => series.status === "active")
    .sort((left, right) => {
      if (left.round !== right.round) {
        return left.round - right.round;
      }
      return left.slot - right.slot;
    });
  return active[0] ?? null;
}

/**
 * When feeder(s) are complete, fill the next-round series and activate it.
 * Supports byeParticipant + one feeder, or two feeders. No reseeding.
 */
function fillReadySeries(
  seriesList: PlayoffSeries[],
  tournament: PlayoffTournament,
): void {
  const byId = new Map(seriesList.map((series) => [series.id, series]));
  const seedByTeam = new Map(
    tournament.qualifiedTeams.map((entry) => [entry.teamId, entry.seed]),
  );

  for (let index = 0; index < seriesList.length; index += 1) {
    const series = seriesList[index]!;
    if (series.status !== "pending" || !series.feederSeriesIds) {
      continue;
    }

    const feeders = series.feederSeriesIds.map((id) => byId.get(id));
    if (feeders.some((f) => !f || f.status !== "complete" || !f.winnerTeamId)) {
      continue;
    }

    let teamA: TeamId;
    let teamB: TeamId;
    let seedA: number;
    let seedB: number;

    if (series.byeParticipant && feeders.length === 1) {
      teamA = series.byeParticipant.teamId;
      seedA = series.byeParticipant.seed;
      teamB = feeders[0]!.winnerTeamId!;
      const feederSeed = seedByTeam.get(teamB);
      if (feederSeed === undefined) {
        throw new Error(`fillReadySeries: missing original seed for ${teamB}.`);
      }
      seedB = feederSeed;
    } else if (feeders.length === 2) {
      teamA = feeders[0]!.winnerTeamId!;
      teamB = feeders[1]!.winnerTeamId!;
      const resolvedA = seedByTeam.get(teamA);
      const resolvedB = seedByTeam.get(teamB);
      if (resolvedA === undefined || resolvedB === undefined) {
        throw new Error(
          `fillReadySeries: missing original seed for ${teamA} or ${teamB}.`,
        );
      }
      seedA = resolvedA;
      seedB = resolvedB;
    } else {
      continue;
    }

    const higherSeed = Math.min(seedA, seedB);
    const lowerSeed = Math.max(seedA, seedB);
    const higherSeedTeamId = seedA < seedB ? teamA : teamB;
    const lowerSeedTeamId = seedA < seedB ? teamB : teamA;

    const filled: PlayoffSeries = {
      ...series,
      higherSeed,
      lowerSeed,
      higherSeedTeamId,
      lowerSeedTeamId,
      wins: {
        [higherSeedTeamId]: 0,
        [lowerSeedTeamId]: 0,
      },
      status: "active",
    };
    seriesList[index] = filled;
    byId.set(filled.id, filled);
  }
}
