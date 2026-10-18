/**
 * Season-length payments (player salaries, national media) are spread over
 * the regular season, as NBA salaries are paid November-April. Each completed
 * week carries its share of the season's regular-season days, so a team pays
 * exactly its annual payroll however many offseason days the calendar skips.
 */

import { addCalendarDays, calendarDaysBetween } from "@/domain/calendar-date";
import type { GameState } from "@/state/game-state";

/** First and last regular-season game dates, or null before the schedule exists. */
export function regularSeasonDateSpan(
  state: GameState,
): { start: string; end: string } | null {
  const games = state.competition.games;
  if (!spanCache.has(games)) {
    spanCache.set(games, computeRegularSeasonDateSpan(games));
  }
  const span = spanCache.get(games);
  return span == null ? null : { ...span };
}

// Payroll math reads the span for every team on every trade evaluation;
// memoize per immutable games map.
const spanCache = new WeakMap<
  GameState["competition"]["games"],
  { start: string; end: string } | null
>();

function computeRegularSeasonDateSpan(
  games: GameState["competition"]["games"],
): { start: string; end: string } | null {
  let start: string | null = null;
  let end: string | null = null;
  for (const game of Object.values(games)) {
    if (game.competitionType !== "regular_season") {
      continue;
    }
    if (start === null || game.date < start) {
      start = game.date;
    }
    if (end === null || game.date > end) {
      end = game.date;
    }
  }
  return start !== null && end !== null ? { start, end } : null;
}

/**
 * Share of the season's regular-season days inside the seven days ending on
 * `weekEndDate`. Summed over every week of a season this is exactly 1.
 */
export function regularSeasonShareOfWeek(
  state: GameState,
  weekEndDate: string,
): number {
  const span = regularSeasonDateSpan(state);
  if (span === null) {
    return 0;
  }
  const totalDays = calendarDaysBetween(span.start, span.end) + 1;
  const weekStart = addCalendarDays(weekEndDate, -6);
  const from = weekStart > span.start ? weekStart : span.start;
  const to = weekEndDate < span.end ? weekEndDate : span.end;
  const overlap = calendarDaysBetween(from, to) + 1;
  return overlap > 0 ? overlap / totalDays : 0;
}

/** Share for a full regular-season week (7 days), or 0 when no season is scheduled. */
export function typicalRegularSeasonWeekShare(state: GameState): number {
  const span = regularSeasonDateSpan(state);
  if (span === null) {
    return 0;
  }
  return Math.min(1, 7 / (calendarDaysBetween(span.start, span.end) + 1));
}
