import { getContractSalaryForYear } from "@/domain/entities/contract";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { DEFAULT_SALARY_CAP } from "@/systems/salary-cap-config";

/**
 * Team payroll for a season year, derived only from player contracts.
 * Does not read TeamFinances.payroll or staff contracts.
 */
export function getTeamPayroll(
  teamId: TeamId,
  year: number,
  state: GameState,
): number {
  let payroll = 0;
  for (const contract of Object.values(state.business.contracts)) {
    if (contract.teamId !== teamId) {
      continue;
    }
    const salary = getContractSalaryForYear(contract, year);
    if (salary !== undefined) {
      payroll += salary;
    }
  }
  return payroll;
}

/**
 * Cap space = league salaryCap − derived player payroll.
 * Prefer omitting salaryCap to use the league setting automatically.
 */
export function getTeamCapSpace(
  teamId: TeamId,
  year: number,
  state: GameState,
  salaryCap: number = getLeagueSalaryCap(state),
): number {
  return salaryCap - getTeamPayroll(teamId, year, state);
}

export function isTeamOverTheCap(
  teamId: TeamId,
  year: number,
  state: GameState,
  salaryCap: number = getLeagueSalaryCap(state),
): boolean {
  return getTeamAmountOverTheCap(teamId, year, state, salaryCap) > 0;
}

export function getTeamAmountOverTheCap(
  teamId: TeamId,
  year: number,
  state: GameState,
  salaryCap: number = getLeagueSalaryCap(state),
): number {
  return Math.max(0, getTeamPayroll(teamId, year, state) - salaryCap);
}

export { DEFAULT_SALARY_CAP };
