import { getIsoWeekId } from "@/domain/calendar-date";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

export type WeeklyPipelineResult = SystemResult & {
  weeklyPipelineRan: boolean;
  completedWeekId: string | null;
};

/**
 * Runs weekly extension points for a completed ISO week window.
 *
 * `completedWeekId` is the week that just ended (not the current calendar week).
 * Example: after simulating Sunday and advancing to Monday, process the Sunday's week.
 *
 * Gameplay steps are intentionally empty until weekly systems exist.
 */
export function runWeeklyPipeline(
  state: GameState,
  completedWeekId: string,
): WeeklyPipelineResult {
  if (state.world.calendar.lastSimulatedWeekId === completedWeekId) {
    return {
      ...systemResult(state),
      weeklyPipelineRan: false,
      completedWeekId: null,
    };
  }

  // Extension point: weekly financial / reporting systems go here in order.

  return {
    ...systemResult({
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          lastSimulatedWeekId: completedWeekId,
        },
      },
    }),
    weeklyPipelineRan: true,
    completedWeekId,
  };
}

/** ISO week id for the date that was just simulated (completed week window). */
export function completedWeekIdForSimulatedDate(simulatedDate: string): string {
  return getIsoWeekId(simulatedDate);
}
