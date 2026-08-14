import type { DomainEvent } from "@/domain/events";
import type {
  PlayoffSeries,
  PlayoffTournament,
} from "@/domain/entities/playoffs";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { generateBracket } from "@/systems/playoff-bracket";
import { getPlayoffTeamCount } from "@/systems/playoff-config";
import { qualifyAndSeed } from "@/systems/playoff-qualification";
import {
  createNextPlayoffGame,
  nextPlayoffGameDate,
} from "@/systems/playoff-scheduling";
import { recordSeriesGameResult } from "@/systems/playoff-series";
import { simulateScheduledGame } from "@/systems/game-simulation";

/**
 * Qualifies teams, builds the bracket, and sets season phase to playoffs.
 * Idempotent when playoffs are already in_progress or complete.
 */
export function startPlayoffs(state: GameState): SystemResult {
  const playoffs = state.competition.playoffs;
  if (playoffs.status === "complete" || playoffs.status === "in_progress") {
    return systemResult(state);
  }

  const teamCount = Object.keys(state.world.teams).length;
  const fieldSize = getPlayoffTeamCount(teamCount);
  if (fieldSize === 0) {
    throw new Error(
      `startPlayoffs requires getPlayoffTeamCount > 0; teamCount=${teamCount}.`,
    );
  }

  const standings = Object.values(state.competition.standings.byTeamId);
  const qualified = qualifyAndSeed(standings, teamCount);
  const tournament = generateBracket(qualified);

  return systemResult({
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        phase: "playoffs",
      },
      playoffs: tournament,
    },
  });
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
  );
  seriesList[seriesIndex] = updatedSeries;

  fillReadySeries(seriesList, playoffs);

  const finalRound = Math.log2(playoffs.fieldSize) - 1;
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
        season: {
          ...state.competition.season,
          phase: "playoffs",
        },
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
    const started = startPlayoffs(current);
    current = started.state;
    events.push(...started.events);
  }

  let guard = 0;
  const maxGames =
    current.competition.playoffs.fieldSize * 7 || Number.MAX_SAFE_INTEGER;

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
 * When both feeder series are complete, fill the next-round series and
 * activate it. Uses original seeds of the two winners (no reseeding).
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

    const feederA = byId.get(series.feederSeriesIds[0]);
    const feederB = byId.get(series.feederSeriesIds[1]);
    if (
      !feederA ||
      !feederB ||
      feederA.status !== "complete" ||
      feederB.status !== "complete" ||
      !feederA.winnerTeamId ||
      !feederB.winnerTeamId
    ) {
      continue;
    }

    const teamA = feederA.winnerTeamId;
    const teamB = feederB.winnerTeamId;
    const seedA = seedByTeam.get(teamA);
    const seedB = seedByTeam.get(teamB);
    if (seedA === undefined || seedB === undefined) {
      throw new Error(
        `fillReadySeries: missing original seed for ${teamA} or ${teamB}.`,
      );
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
