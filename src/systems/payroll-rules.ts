/**
 * League payroll rules: luxury tax and salary floor.
 *
 * Both are assessed once a season, when the regular season ends, on payroll
 * from {@link getTeamPayroll} (dead money included):
 * - Tax: payroll above the threshold is taxed in tiers of
 *   {@link LUXURY_TAX_TIER_CAP_SHARE} of the cap; the first tier pays the
 *   base rate, each later tier {@link LUXURY_TAX_TIER_STEP} more. Proceeds
 *   are split evenly among teams that paid no tax.
 * - Floor: a team below it pays the shortfall (to its players).
 *
 * Results are stored per season in `business.payrollAssessments`, which
 * also makes the assessment idempotent. Every team, owner or CPU, is
 * assessed the same way.
 */

import type { PayrollAssessment } from "@/domain/entities/payroll-assessment";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameSettings } from "@/domain/game-settings";
import type { GameState } from "@/state/game-state";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { getTeamPayroll } from "@/systems/salary-cap";
import { applyBusinessFundsImpact } from "@/systems/team-finances";

/** Width of each tax tier as a share of the cap. */
export const LUXURY_TAX_TIER_CAP_SHARE = 0.05;
/** Rate added for each tier past the first. */
export const LUXURY_TAX_TIER_STEP = 0.5;

export function luxuryTaxThreshold(settings: GameSettings, cap: number) {
  return Math.round(
    cap * (1 + settings.financialRules.luxuryTaxThresholdPercent / 100),
  );
}

export function salaryFloor(settings: GameSettings, cap: number) {
  return Math.round((cap * settings.financialRules.salaryFloorPercent) / 100);
}

/**
 * Tax owed on a payroll. Tiered: dollars over the threshold in the first
 * tier pay `baseRate`, the next tier `baseRate + step`, and so on.
 */
export function luxuryTaxBill(
  payroll: number,
  threshold: number,
  cap: number,
  baseRate: number,
): number {
  let over = payroll - threshold;
  if (over <= 0) return 0;
  const tier = Math.max(1, Math.round(cap * LUXURY_TAX_TIER_CAP_SHARE));
  let rate = baseRate;
  let bill = 0;
  while (over > 0) {
    const slice = Math.min(over, tier);
    bill += slice * rate;
    over -= slice;
    rate += LUXURY_TAX_TIER_STEP;
  }
  return Math.round(bill);
}

export type PayrollProjection = {
  payroll: number;
  threshold: number | null;
  floor: number | null;
  taxBill: number;
  floorShortfall: number;
};

/** What a team would owe today on a season's payroll. */
export function projectPayrollAssessment(
  state: GameState,
  teamId: TeamId,
  year: number,
  payroll: number = getTeamPayroll(teamId, year, state),
): PayrollProjection {
  const rules = state.settings.financialRules;
  const cap = getLeagueSalaryCap(state);
  const threshold = rules.luxuryTaxEnabled
    ? luxuryTaxThreshold(state.settings, cap)
    : null;
  const floor = rules.salaryFloorEnabled
    ? salaryFloor(state.settings, cap)
    : null;
  return {
    payroll,
    threshold,
    floor,
    taxBill:
      threshold === null
        ? 0
        : luxuryTaxBill(payroll, threshold, cap, rules.luxuryTaxBaseRate),
    floorShortfall: floor === null ? 0 : Math.max(0, floor - payroll),
  };
}

/**
 * Assess the tax and floor for the season that just finished its regular
 * season. Idempotent per season year.
 */
export function assessPayrollRules(state: GameState): SystemResult {
  const year = state.competition.season.year;
  const key = String(year);
  const rules = state.settings.financialRules;
  if (state.business.payrollAssessments?.[key] !== undefined) {
    return systemResult(state);
  }
  if (!rules.luxuryTaxEnabled && !rules.salaryFloorEnabled) {
    return systemResult(state);
  }

  const teamIds = Object.keys(state.world.teams).sort() as TeamId[];
  const rows: Record<string, PayrollAssessment> = {};
  for (const teamId of teamIds) {
    const p = projectPayrollAssessment(state, teamId, year);
    rows[teamId] = {
      teamId,
      seasonYear: year,
      payroll: p.payroll,
      threshold: p.threshold,
      floor: p.floor,
      taxBill: p.taxBill,
      floorShortfall: p.floorShortfall,
      taxShare: 0,
    };
  }

  // Proceeds go to every team that paid no tax, evenly (remainder by id).
  const pool = teamIds.reduce((sum, id) => sum + rows[id]!.taxBill, 0);
  const receivers = teamIds.filter((id) => rows[id]!.taxBill === 0);
  if (pool > 0 && receivers.length > 0) {
    const each = Math.floor(pool / receivers.length);
    let leftover = pool - each * receivers.length;
    for (const id of receivers) {
      rows[id]!.taxShare = each + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover -= 1;
    }
  }

  let current: GameState = state;
  const events: DomainEvent[] = [];
  for (const teamId of teamIds) {
    const row = rows[teamId]!;
    if (!current.business.finances[teamId]) continue;
    // Tax and floor post as operations expenses; the share as other revenue.
    for (const amount of [-row.taxBill, -row.floorShortfall, row.taxShare]) {
      if (amount === 0) continue;
      current = applyBusinessFundsImpact(current, teamId, amount, year, {
        expenseCategory: "operations",
        revenueCategory: "other",
      }).state;
    }
    if (row.taxBill > 0 || row.floorShortfall > 0) {
      events.push(
        createDomainEvent({
          type: "PayrollRulesAssessed",
          occurredOn: current.world.calendar.currentDate,
          payload: {
            teamId,
            seasonYear: year,
            payroll: row.payroll,
            taxBill: row.taxBill,
            floorShortfall: row.floorShortfall,
          },
        }),
      );
    }
  }

  current = {
    ...current,
    business: {
      ...current.business,
      payrollAssessments: {
        ...(current.business.payrollAssessments ?? {}),
        [key]: rows,
      },
    },
  };
  return systemResult(current, events);
}
