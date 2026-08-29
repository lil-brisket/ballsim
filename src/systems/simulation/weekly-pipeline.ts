import { getIsoWeekId } from "@/domain/calendar-date";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  processWeeklyFacilityOpex,
  processWeeklyFacilityUpgrades,
} from "@/systems/facilities";
import { processWeeklyMarketing } from "@/systems/marketing";
import { processWeeklyMediaDecay } from "@/systems/media";
import { runAiFranchiseDecisions } from "@/systems/ai-franchise-decisions";
import { createSeededRng } from "@/domain/rng";

export type WeeklyPipelineResult = SystemResult & {
  weeklyPipelineRan: boolean;
  completedWeekId: string | null;
};

/**
 * Runs weekly extension points for a completed ISO week window.
 *
 * `completedWeekId` is the week that just ended (not the current calendar week).
 * Example: after simulating Sunday and advancing to Monday, process the Sunday's week.
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

  let current = state;
  const events: SystemResult["events"] = [];

  // Staff and player payroll are commitment limits (staff budget / salary cap),
  // not business-funds drains — skip weekly cash deductions.

  const facilityOpex = processWeeklyFacilityOpex(current);
  current = facilityOpex.state;
  events.push(...facilityOpex.events);

  const facilityUpgrades = processWeeklyFacilityUpgrades(current);
  current = facilityUpgrades.state;
  events.push(...facilityUpgrades.events);

  const marketing = processWeeklyMarketing(current);
  current = marketing.state;
  events.push(...marketing.events);

  const media = processWeeklyMediaDecay(current);
  current = media.state;
  events.push(...media.events);

  // Mark week before AI so idempotency keys include the completed week id.
  current = {
    ...current,
    world: {
      ...current.world,
      calendar: {
        ...current.world.calendar,
        lastSimulatedWeekId: completedWeekId,
      },
    },
  };

  const ai = runAiFranchiseDecisions(
    current,
    createSeededRng(current.meta.rngState),
  );
  current = ai.state;
  events.push(...ai.events);

  return {
    ...systemResult(current, events),
    weeklyPipelineRan: true,
    completedWeekId,
  };
}

/** ISO week id for the date that was just simulated (completed week window). */
export function completedWeekIdForSimulatedDate(simulatedDate: string): string {
  return getIsoWeekId(simulatedDate);
}
