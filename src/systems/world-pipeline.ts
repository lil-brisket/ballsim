import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { DomainEvent } from "@/domain/events";
import type { GameState } from "@/state/game-state";
import { generateRosters } from "@/systems/roster-generation";
import { generateSchedule } from "@/systems/schedule-generation";
import { simulateGamesForDate } from "@/systems/game-simulation";
import { updateStandings } from "@/systems/standings";
import { advanceCalendar } from "@/systems/calendar";

export type WorldPipelineCommand = {
  type: "advanceDay";
};

/**
 * Ensures roster and schedule exist (world-gen bootstrap).
 * Idempotent; safe before advance day or on new save creation.
 */
export function bootstrapWorld(state: GameState, rng: Rng): SystemResult {
  const afterRosters = generateRosters(state, rng);
  const afterSchedule = generateSchedule(afterRosters.state);
  return systemResult(afterSchedule.state, [
    ...afterRosters.events,
    ...afterSchedule.events,
  ]);
}

/**
 * World pipeline for Owner Mode.
 *
 * Advance-day order (games for the current date, then calendar tick):
 * 1. Bootstrap roster/schedule if missing
 * 2. Game simulation for currentDate
 * 3. Standings rebuild
 * 4. Calendar +1 day
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

  const standingsResult = updateStandings(current);
  current = standingsResult.state;
  events.push(...standingsResult.events);

  const calendarResult = advanceCalendar(current);
  current = calendarResult.state;
  events.push(...calendarResult.events);

  return systemResult(current, events);
}
