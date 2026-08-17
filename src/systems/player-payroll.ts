import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getTeamPayroll } from "@/systems/salary-cap";
import { applyCashOnlyImpact } from "@/systems/team-finances";

/**
 * Initial weekly amortization divisor for player payroll cash outflow.
 * Experiment starting point — not a locked economic model.
 * Observe multi-season cash trajectories before changing magnitude/cadence.
 */
export const PLAYER_PAYROLL_WEEKS_PER_YEAR = 52;

/**
 * Weekly cash outflow for player salaries for all teams.
 * Does not post books (statement already derives annual playerSalaries).
 * Emits PlayerPayrollPaid per team with a non-zero payment.
 */
export function processWeeklyPlayerPayroll(state: GameState): SystemResult {
  const year = state.competition.season.year;
  const events: SystemResult["events"] = [];
  let current = state;

  const teamIds = Object.keys(current.world.teams).sort() as TeamId[];
  for (const teamId of teamIds) {
    const annual = getTeamPayroll(teamId, year, current);
    const weekly = Math.floor(annual / PLAYER_PAYROLL_WEEKS_PER_YEAR);
    if (weekly <= 0) {
      continue;
    }
    const impact = applyCashOnlyImpact(current, teamId, -weekly, {
      period: "weekly",
    });
    current = impact.state;
    events.push(...impact.events);
  }

  return systemResult(current, events);
}
