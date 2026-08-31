import { getCalendarMonthId } from "@/domain/calendar-date";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { runMonthlyAwards } from "@/systems/awards/award-pipeline";
import {
  processMonthlyBroadcastRevenue,
  processMonthlyLeagueEconomyDrift,
} from "@/systems/league-economy";
import { processMonthlyReputation } from "@/systems/reputation";
import { processMonthlySponsorshipRevenue } from "@/systems/sponsorships";

export type MonthlyPipelineResult = SystemResult & {
  monthlyPipelineRan: boolean;
  completedMonthId: string | null;
};

/**
 * Runs monthly extension points for a completed calendar month window.
 *
 * `completedMonthId` is the month that just ended (YYYY-MM).
 */
export function runMonthlyPipeline(
  state: GameState,
  completedMonthId: string,
): MonthlyPipelineResult {
  if (state.world.calendar.lastSimulatedMonthId === completedMonthId) {
    return {
      ...systemResult(state),
      monthlyPipelineRan: false,
      completedMonthId: null,
    };
  }

  let current = state;
  const events: SystemResult["events"] = [];

  const sponsorship = processMonthlySponsorshipRevenue(current);
  current = sponsorship.state;
  events.push(...sponsorship.events);

  const drift = processMonthlyLeagueEconomyDrift(current);
  current = drift.state;
  events.push(...drift.events);

  const reputation = processMonthlyReputation(current);
  current = reputation.state;
  events.push(...reputation.events);

  const broadcast = processMonthlyBroadcastRevenue(current);
  current = broadcast.state;
  events.push(...broadcast.events);

  const awards = runMonthlyAwards(current, completedMonthId);
  current = awards.state;
  events.push(...awards.events);

  return {
    ...systemResult(
      {
        ...current,
        world: {
          ...current.world,
          calendar: {
            ...current.world.calendar,
            lastSimulatedMonthId: completedMonthId,
          },
        },
      },
      events,
    ),
    monthlyPipelineRan: true,
    completedMonthId,
  };
}

/** Month id for the date that was just simulated (completed month window). */
export function completedMonthIdForSimulatedDate(simulatedDate: string): string {
  return getCalendarMonthId(simulatedDate);
}
