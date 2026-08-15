import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { DomainEvent } from "@/domain/events";
import type { GameState } from "@/state/game-state";
import { mergeDraftPicksForSeason } from "@/domain/draft-picks/generate-draft-picks";
import { generateRosters } from "@/systems/roster-generation";
import { generateSchedule } from "@/systems/schedule-generation";
import { simulateGamesForDate } from "@/systems/game-simulation";
import { updateStandings } from "@/systems/standings";
import { advanceCalendar } from "@/systems/calendar";
import { getPlayoffTeamCount } from "@/systems/playoff-config";
import {
  simulateNextPlayoffGame,
  startPlayoffs,
} from "@/systems/playoff-simulation";

export type WorldPipelineCommand = {
  type: "advanceDay";
};

/**
 * Ensures roster, draft picks, and schedule exist (world-gen bootstrap).
 * Idempotent; safe before advance day or on new save creation.
 */
export function bootstrapWorld(state: GameState, rng: Rng): SystemResult {
  const afterRosters = generateRosters(state, rng);
  const afterPicks = ensureDraftPicks(afterRosters.state);
  const afterSchedule = generateSchedule(afterPicks);
  return systemResult(afterSchedule.state, [
    ...afterRosters.events,
    ...afterSchedule.events,
  ]);
}

/**
 * Idempotently ensures every team has picks for the next three seasons
 * relative to competition.season.year. Preserves existing picks.
 */
export function ensureDraftPicks(state: GameState): GameState {
  const teams = Object.values(state.world.teams);
  const draftPicks = mergeDraftPicksForSeason(
    state.world.draftPicks,
    teams,
    state.competition.season.year,
  );
  if (draftPicks === state.world.draftPicks) {
    return state;
  }
  const existingKeys = Object.keys(state.world.draftPicks);
  const nextKeys = Object.keys(draftPicks);
  if (
    existingKeys.length === nextKeys.length &&
    existingKeys.every((key) => draftPicks[key] === state.world.draftPicks[key])
  ) {
    return state;
  }
  return {
    ...state,
    world: {
      ...state.world,
      draftPicks,
    },
  };
}

/**
 * World pipeline for Owner Mode.
 *
 * Advance-day order (games for the current date, then calendar tick):
 * 1. Bootstrap roster/schedule if missing
 * 2. Game simulation for currentDate
 * 3. If regular season is complete and playoffs apply, start/sim one playoff game
 * 4. Standings rebuild (regular schedule only)
 * 5. Calendar +1 day
 *
 * Callers must persist `rng.getState()` into `meta.rngState` after this runs.
 */
export function runWorldPipeline(
  state: GameState,
  rng: Rng,
  command: WorldPipelineCommand,
): SystemResult {
  if (command.type !== "advanceDay") {
    return systemResult(state);
  }

  return advanceDay(state, rng);
}

function advanceDay(state: GameState, rng: Rng): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;

  const bootstrapped = bootstrapWorld(current, rng);
  current = bootstrapped.state;
  events.push(...bootstrapped.events);

  const date = current.world.calendar.currentDate;
  const gamesResult = simulateGamesForDate(current, rng, date);
  current = gamesResult.state;
  events.push(...gamesResult.events);

  const playoffResult = maybeAdvancePlayoffs(current, rng);
  current = playoffResult.state;
  events.push(...playoffResult.events);

  const standingsResult = updateStandings(current);
  current = standingsResult.state;
  events.push(...standingsResult.events);

  const calendarResult = advanceCalendar(current);
  current = calendarResult.state;
  events.push(...calendarResult.events);

  return systemResult(current, events);
}

function maybeAdvancePlayoffs(state: GameState, rng: Rng): SystemResult {
  const teamCount = Object.keys(state.world.teams).length;
  if (getPlayoffTeamCount(teamCount) === 0) {
    return systemResult(state);
  }

  if (!allRegularSeasonGamesFinal(state)) {
    return systemResult(state);
  }

  if (state.competition.playoffs.status === "complete") {
    return systemResult(state);
  }

  const events: DomainEvent[] = [];
  let current = state;

  if (current.competition.playoffs.status === "not_started") {
    const started = startPlayoffs(current);
    current = started.state;
    events.push(...started.events);
  }

  if (current.competition.playoffs.status === "in_progress") {
    const step = simulateNextPlayoffGame(current, rng);
    current = step.state;
    events.push(...step.events);
  }

  return systemResult(current, events);
}

function allRegularSeasonGamesFinal(state: GameState): boolean {
  const { schedule, games } = state.competition;
  if (schedule.gameIds.length === 0) {
    return false;
  }
  for (const gameId of schedule.gameIds) {
    const game = games[gameId];
    if (!game || game.status !== "final") {
      return false;
    }
  }
  return true;
}
