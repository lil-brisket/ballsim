import {
  getStaffContractSalaryForYear,
  isStaffContractActive,
} from "@/domain/entities/staff-contract";
import type { GameSettings } from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { DEFAULT_STAFF_BUDGET } from "@/systems/staff-budget-config";

/** Authoritative staff budget from league settings. */
export function getLeagueStaffBudgetFromSettings(settings: GameSettings): number {
  const value = settings.financialRules.staffBudget;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return DEFAULT_STAFF_BUDGET;
}

/** Authoritative league staff budget for the save. */
export function getLeagueStaffBudget(state: GameState): number {
  return getLeagueStaffBudgetFromSettings(state.settings);
}

/**
 * Team staff payroll for a season year, derived only from staff contracts.
 * Does not read business funds or player salary cap.
 */
export function getTeamStaffPayroll(
  teamId: TeamId,
  year: number,
  state: GameState,
): number {
  let payroll = 0;
  for (const contract of Object.values(state.business.staffContracts)) {
    if (contract.teamId !== teamId) {
      continue;
    }
    if (!isStaffContractActive(contract, year)) {
      continue;
    }
    const salary = getStaffContractSalaryForYear(contract, year);
    if (salary !== undefined) {
      payroll += salary;
    }
  }
  return payroll;
}

/**
 * Available staff budget = league staffBudget − committed staff payroll.
 */
export function getTeamStaffBudgetSpace(
  teamId: TeamId,
  year: number,
  state: GameState,
  staffBudget: number = getLeagueStaffBudget(state),
): number {
  return staffBudget - getTeamStaffPayroll(teamId, year, state);
}

export function isTeamOverStaffBudget(
  teamId: TeamId,
  year: number,
  state: GameState,
  staffBudget: number = getLeagueStaffBudget(state),
): boolean {
  return getTeamAmountOverStaffBudget(teamId, year, state, staffBudget) > 0;
}

export function getTeamAmountOverStaffBudget(
  teamId: TeamId,
  year: number,
  state: GameState,
  staffBudget: number = getLeagueStaffBudget(state),
): number {
  return Math.max(0, getTeamStaffPayroll(teamId, year, state) - staffBudget);
}
