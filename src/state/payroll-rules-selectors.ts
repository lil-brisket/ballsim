/**
 * Payroll-rules view: the tax line, the floor, what the owner team would owe
 * on today's payroll, and last season's assessment. Presentation only.
 */

import type { PayrollAssessment } from "@/domain/entities/payroll-assessment";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { projectPayrollAssessment } from "@/systems/payroll-rules";
import { getContractSigningYear } from "@/systems/salary-cap";

export type PayrollRulesView = {
  /** Season the projection covers (next season during the offseason). */
  seasonYear: number;
  payroll: number;
  luxuryTaxEnabled: boolean;
  /** Tax line, or null when the tax is off. */
  threshold: number | null;
  /** Tax owed if the season ended with today's payroll. */
  projectedTax: number;
  salaryFloorEnabled: boolean;
  floor: number | null;
  /** Floor shortfall owed if the season ended with today's payroll. */
  projectedFloorShortfall: number;
  veteranRightsEnabled: boolean;
  veteranRightsSeasons: number;
  /** The most recent season's assessment for the owner team, if any. */
  lastAssessment: PayrollAssessment | null;
};

export function toPayrollRulesView(state: GameState): PayrollRulesView {
  const teamId = getActiveOwnerTeamId(state);
  const year = getContractSigningYear(state);
  const projection = projectPayrollAssessment(state, teamId, year);
  const rules = state.settings.financialRules;
  const years = Object.keys(state.business.payrollAssessments ?? {}).sort();
  const latest = years[years.length - 1];
  return {
    seasonYear: year,
    payroll: projection.payroll,
    luxuryTaxEnabled: rules.luxuryTaxEnabled,
    threshold: projection.threshold,
    projectedTax: projection.taxBill,
    salaryFloorEnabled: rules.salaryFloorEnabled,
    floor: projection.floor,
    projectedFloorShortfall: projection.floorShortfall,
    veteranRightsEnabled: rules.veteranRightsEnabled,
    veteranRightsSeasons: rules.veteranRightsSeasons,
    lastAssessment:
      latest !== undefined
        ? (state.business.payrollAssessments[latest]?.[teamId] ?? null)
        : null,
  };
}
