/**
 * Planned regular-season / preseason dates for display and anchors while the
 * league has not yet committed regularSeasonStartDate.
 *
 * Planned values never enter the regular season by themselves and must not
 * overwrite snapshotted / schedule-derived anchors once the season progresses.
 *
 * Concepts (must not be interchangeable):
 * - currentDate — simulation's current day
 * - preseason start — phase.enteredDate while in preseason.preparation
 * - regularSeasonStartDate — opening night (committed or planned)
 */

import { addCalendarDays } from "@/domain/calendar-date";
import type { GameState } from "@/state/game-state";
import { getActivePhaseId } from "@/systems/phase-engine";
import { PRESEASON_LENGTH_DAYS } from "@/systems/simulation/offseason-calendar-config";

/**
 * True when the league is still in preseason and has not yet entered the regular season.
 * Do not use empty schedule as a proxy — empty schedule can mean corruption or custom leagues.
 */
export function needsRegularSeasonInitialization(state: GameState): boolean {
  return (
    state.competition.season.phase === "preseason" &&
    getActivePhaseId(state) === "preseason.preparation"
  );
}

/**
 * Planned opener for display / milestones while still in preseason.
 * Derived only — never written to regularSeasonStartDate (that field is authoritative
 * after beginRegularSeasonFromPreseason). Must not alone enter the regular season.
 *
 * When initialization is no longer pending, returns the committed regularSeasonStartDate
 * (or null if unset).
 *
 * While pending: opener = phase.enteredDate + PRESEASON_LENGTH_DAYS
 * (new saves enter on preseason start, not opening night).
 */
export function derivePlannedRegularSeasonStartDate(
  state: GameState,
): string | null {
  if (!needsRegularSeasonInitialization(state)) {
    return state.competition.season.regularSeasonStartDate;
  }
  const entered =
    state.competition.phase?.enteredDate ??
    state.world.calendar.currentDate;
  return addCalendarDays(entered, PRESEASON_LENGTH_DAYS);
}

/**
 * Planned preseason start derived from {@link derivePlannedRegularSeasonStartDate}.
 * Only meaningful while initialization is pending (planned opener exists from
 * preseason rules). Returns null once the season has left preseason.preparation
 * so callers fall through to window / anchor precedence.
 */
export function derivePlannedPreseasonStartDate(
  state: GameState,
): string | null {
  if (!needsRegularSeasonInitialization(state)) {
    return null;
  }
  const plannedOpener = derivePlannedRegularSeasonStartDate(state);
  if (plannedOpener == null) {
    return null;
  }
  return addCalendarDays(plannedOpener, -PRESEASON_LENGTH_DAYS);
}
