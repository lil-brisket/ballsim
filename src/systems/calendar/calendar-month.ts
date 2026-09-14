/**
 * Month grid helpers for calendar UI.
 */

import {
  addCalendarDays,
  formatCalendarDate,
  parseCalendarDate,
} from "@/domain/calendar-date";
import type { CalendarEventView } from "@/domain/entities/calendar-event";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { projectOwnerCalendarEvents } from "@/systems/calendar/project-owner-calendar";
import {
  getNextTeamGameDate,
  getTeamGameForDate,
  projectTeamGameView,
  type TeamCalendarGameView,
} from "@/systems/calendar/schedule-projection";

export type CalendarDayIndicatorCounts = {
  games: number;
  actionRequired: number;
  deadlines: number;
  other: number;
};

export type CalendarDayCell = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  events: CalendarEventView[];
  indicatorCounts: CalendarDayIndicatorCounts;
  /** Controlled-team game on this date, if any. */
  teamGame: TeamCalendarGameView | null;
  /** Non-game owner-relevant events on this date. */
  specialEvents: CalendarEventView[];
  /** True when this date is the next controlled-team game. */
  isNextTeamGame: boolean;
};

export type CalendarMonthGrid = {
  year: number;
  month: number;
  weeks: CalendarDayCell[][];
  currentDate: string;
  nextTeamGameDate: string | null;
};

export type GetCalendarMonthGridOptions = {
  saveId?: string;
  teamId?: TeamId;
};

/**
 * Builds a Monday-start month grid with leading/trailing days from adjacent months.
 * Uses owner-calendar projection (controlled-team games + owner-relevant events).
 */
export function getCalendarMonthGrid(
  state: GameState,
  year: number,
  month: number,
  options: GetCalendarMonthGridOptions = {},
): CalendarMonthGrid {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(
      `getCalendarMonthGrid requires year and month 1–12; got ${year}-${month}.`,
    );
  }

  const currentDate = state.world.calendar.currentDate;
  const teamId = options.teamId ?? state.user.activeOwnerTeamId;
  const nextTeamGameDate = getNextTeamGameDate(state, teamId);

  const monthStart = formatCalendarDate(year, month, 1);
  const nextMonthStart =
    month === 12
      ? formatCalendarDate(year + 1, 1, 1)
      : formatCalendarDate(year, month + 1, 1);
  const monthEnd = addCalendarDays(nextMonthStart, -1);

  const startWeekday = weekdayMondayFirst(monthStart);
  const gridStart = addCalendarDays(monthStart, -startWeekday);
  const endWeekday = weekdayMondayFirst(monthEnd);
  const gridEnd = addCalendarDays(monthEnd, 6 - endWeekday);

  const events = projectOwnerCalendarEvents(state, {
    from: gridStart,
    to: gridEnd,
    saveId: options.saveId,
    teamId,
  });

  const eventsByDate = new Map<string, CalendarEventView[]>();
  for (const event of events) {
    const list = eventsByDate.get(event.date);
    if (list) {
      list.push(event);
    } else {
      eventsByDate.set(event.date, [event]);
    }
  }

  const weeks: CalendarDayCell[][] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const week: CalendarDayCell[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const dayEvents = eventsByDate.get(cursor) ?? [];
      const { year: cellYear, month: cellMonth } = parseCalendarDate(cursor);
      const rawGame = getTeamGameForDate(state, teamId, cursor);
      const teamGame = rawGame
        ? projectTeamGameView(state, teamId, rawGame)
        : null;
      const specialEvents = dayEvents.filter(
        (event) => event.category !== "game",
      );
      week.push({
        date: cursor,
        inMonth: cellYear === year && cellMonth === month,
        isToday: cursor === currentDate,
        isPast: cursor < currentDate,
        isFuture: cursor > currentDate,
        events: dayEvents,
        indicatorCounts: countIndicators(dayEvents),
        teamGame,
        specialEvents,
        isNextTeamGame: nextTeamGameDate != null && cursor === nextTeamGameDate,
      });
      cursor = addCalendarDays(cursor, 1);
    }
    weeks.push(week);
  }

  return { year, month, weeks, currentDate, nextTeamGameDate };
}

function weekdayMondayFirst(isoDate: string): number {
  const { year, month, day } = parseCalendarDate(isoDate);
  const utcDay = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
  return utcDay === 0 ? 6 : utcDay - 1;
}

function countIndicators(
  events: readonly CalendarEventView[],
): CalendarDayIndicatorCounts {
  let games = 0;
  let actionRequired = 0;
  let deadlines = 0;
  let other = 0;
  for (const event of events) {
    if (event.lifecycle === "action_required" || event.blocking) {
      actionRequired += 1;
    } else if (event.category === "game") {
      games += 1;
    } else if (event.category === "deadline") {
      deadlines += 1;
    } else {
      other += 1;
    }
  }
  return { games, actionRequired, deadlines, other };
}
