import { addCalendarDays } from "@/domain/calendar-date";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

/** Advances the world calendar by one day. Preserves simulation progress markers. */
export function advanceCalendar(state: GameState): SystemResult {
  const nextDate = addCalendarDays(state.world.calendar.currentDate, 1);
  return systemResult({
    ...state,
    world: {
      ...state.world,
      calendar: {
        ...state.world.calendar,
        currentDate: nextDate,
      },
    },
  });
}
