import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import { processHolidays } from "@/systems/season-events/process-holidays";
import { processFanVoting } from "@/systems/season-events/process-fan-voting";
import { processAllStar } from "@/systems/season-events/process-all-star";
import { processMidseasonAwards } from "@/systems/season-events/process-midseason-awards";
import { processTournament } from "@/systems/season-events/process-tournament";
import {
  ensureSeasonEventsState,
  withSeasonEvents,
} from "@/systems/season-events/plan-season-events";

/**
 * Authoritative date-driven season-event orchestrator.
 * Runs once per simulated day AFTER regular-season games finalize.
 *
 * Same-day priority:
 * 1. Holiday activation
 * 2. Fan voting — open / daily tick
 * 3. (RS games already ran in daily pipeline)
 * 4. Fan voting — close / finalize rankings
 * 5. All-Star — selection rules (after vote close)
 * 6. Midseason awards — evaluate at cutoff
 * 7. All-Star — exhibition game sim
 * 8. Tournament — qual / games
 * 9. Holiday completion
 */
export function processSeasonEvents(
  state: GameState,
  rng: Rng,
): SystemResult {
  let current = withSeasonEvents(state, ensureSeasonEventsState(state));
  const events: DomainEvent[] = [];
  const simulatedDate = current.world.calendar.currentDate;

  if (Object.keys(current.competition.seasonEvents.events).length === 0) {
    return systemResult(current);
  }

  const holidays = processHolidays(current, simulatedDate, "activate");
  current = holidays.state;
  events.push(...holidays.events);

  const voting = processFanVoting(current, rng, simulatedDate);
  current = voting.state;
  events.push(...voting.events);

  const allStar = processAllStar(current, rng, simulatedDate);
  current = allStar.state;
  events.push(...allStar.events);

  const awards = processMidseasonAwards(current, simulatedDate);
  current = awards.state;
  events.push(...awards.events);

  const tournament = processTournament(current, rng, simulatedDate);
  current = tournament.state;
  events.push(...tournament.events);

  const holidayEnd = processHolidays(current, simulatedDate, "complete");
  current = holidayEnd.state;
  events.push(...holidayEnd.events);

  if (events.length > 0) {
    current = appendSeasonEventLog(current, events);
  }

  return systemResult(current, events);
}
