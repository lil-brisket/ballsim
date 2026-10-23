import { addCalendarDays } from "@/domain/calendar-date";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getTeamPayroll, getTeamPrepaidDeadMoney } from "@/systems/salary-cap";
import { regularSeasonShareOfWeek } from "@/systems/regular-season-pay";
import { applyCashOnlyImpact } from "@/systems/team-finances";

/**
 * Drains the week's share of annual player payroll from businessFunds: the
 * week's regular-season days over the season's (see regular-season-pay), so
 * cash pays exactly the contracts and offseason weeks cost nothing. Annual
 * payroll / 52 per simulated week let skipped offseason weeks go unpaid
 * (CBL teams paid ~32% of payroll, standard ~73%; #93). Does not post
 * playerSalaries to books (those stay derived from contracts on the
 * statement).
 *
 * `weekEndDate` is the last day of the completed week (default: yesterday,
 * as the weekly pipeline runs on the Monday after).
 */
export function processWeeklyPlayerPayroll(
  state: GameState,
  weekEndDate: string = addCalendarDays(state.world.calendar.currentDate, -1),
): SystemResult {
  const share = regularSeasonShareOfWeek(state, weekEndDate);
  if (share <= 0) {
    return systemResult(state);
  }
  const year = state.competition.season.year;
  const occurredOn = state.world.calendar.currentDate;
  let current = state;
  const events: DomainEvent[] = [];

  for (const team of Object.values(state.world.teams)) {
    const teamId = team.id as TeamId;
    // Buyout money was paid at release; only the rest is drawn weekly.
    const annual =
      getTeamPayroll(teamId, year, current) -
      getTeamPrepaidDeadMoney(teamId, year, current);
    const weekly = Math.round(annual * share);
    if (weekly <= 0) continue;
    const impact = applyCashOnlyImpact(current, teamId, -weekly);
    current = impact.state;
    events.push(
      createDomainEvent({
        type: "PlayerPayrollPaid",
        occurredOn,
        payload: { teamId, amount: weekly, seasonYear: year },
      }),
    );
  }

  return systemResult(current, events);
}
