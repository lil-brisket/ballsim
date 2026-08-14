import { addCalendarDays } from "@/domain/calendar-date";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

/** Advances the world calendar by one day. */
export function advanceCalendar(state: GameState): SystemResult {
  const nextDate = addCalendarDays(state.world.calendar.currentDate, 1);
  return systemResult({
    ...state,
    world: {
      ...state.world,
      calendar: {
        currentDate: nextDate,
      },
    },
  });
}
