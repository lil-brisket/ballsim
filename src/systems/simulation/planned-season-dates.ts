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
 *
 * Opening night is canonical per season year ({year}-10-01). Offseason windows
 * use the upcoming year so staff development holds until the next preseason
 * instead of sliding with playoff length.
 */

import { addCalendarDays } from "@/domain/calendar-date";
import type { GameState } from "@/state/game-state";
import { getActivePhaseId } from "@/systems/phase-engine";
import { PRESEASON_LENGTH_DAYS } from "@/systems/simulation/offseason-calendar-config";
import { canonicalRegularSeasonStartDate } from "@/systems/simulation/season-lifecycle-config";

export {
  canonicalPreseasonStartDate,
  canonicalRegularSeasonStartDate,
} from "@/systems/simulation/season-lifecycle-config";

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
 * Season year whose opener/preseason the calendar should target next.
 * Offseason still belongs to the completed year, so windows look at year + 1.
 */
export function upcomingSeasonYear(state: GameState): number {
  if (state.competition.season.phase === "offseason") {
    return state.competition.season.year + 1;
  }
  return state.competition.season.year;
}

/**
 * Upcoming opening night: canonical {year}-10-01, or currentDate when the
 * calendar has already overrun that date (never rewind).
 */
export function deriveUpcomingRegularSeasonStartDate(state: GameState): string {
  const canonical = canonicalRegularSeasonStartDate(upcomingSeasonYear(state));
  const current = state.world.calendar.currentDate;
  return current > canonical ? current : canonical;
}

/**
 * Upcoming preseason start: 21 days before {@link deriveUpcomingRegularSeasonStartDate}.
 */
export function deriveUpcomingPreseasonStartDate(state: GameState): string {
  return addCalendarDays(
    deriveUpcomingRegularSeasonStartDate(state),
    -PRESEASON_LENGTH_DAYS,
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
 * While pending: opener = canonical {season.year}-10-01 (or currentDate if later).
 */
export function derivePlannedRegularSeasonStartDate(
  state: GameState,
): string | null {
  if (!needsRegularSeasonInitialization(state)) {
    return state.competition.season.regularSeasonStartDate;
  }
  return deriveUpcomingRegularSeasonStartDate(state);
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
