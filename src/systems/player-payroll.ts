import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getTeamPayroll } from "@/systems/salary-cap";
import { applyCashOnlyImpact } from "@/systems/team-finances";

/** Weekly amortization divisor for player payroll cash drain. */
export const PLAYER_PAYROLL_WEEKS_PER_YEAR = 52;

/**
 * Drains weekly player payroll from businessFunds. Does not post playerSalaries
 * to books (those stay derived from contracts on the statement).
 */
export function processWeeklyPlayerPayroll(state: GameState): SystemResult {
  const year = state.competition.season.year;
  const occurredOn = state.world.calendar.currentDate;
  let current = state;
  const events: DomainEvent[] = [];

  for (const team of Object.values(state.world.teams)) {
    const teamId = team.id as TeamId;
    const annual = getTeamPayroll(teamId, year, current);
    const weekly = Math.round(annual / PLAYER_PAYROLL_WEEKS_PER_YEAR);
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
