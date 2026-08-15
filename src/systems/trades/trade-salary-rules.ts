import { DEFAULT_SALARY_CAP } from "@/systems/salary-cap-config";
import { TRADE_SALARY_MATCHING_PERCENT } from "@/systems/trades-config";

export type TradeSalaryInputs = {
  currentPayroll: number;
  outgoingSalary: number;
  incomingSalary: number;
  salaryCap?: number;
  matchingPercent?: number;
};

export type TradeSalaryRuleResult = {
  valid: boolean;
  projectedPayroll: number;
  reason?: string;
};

/**
 * League salary-matching policy for trades.
 *
 * projectedPayroll = currentPayroll - outgoingSalary + incomingSalary
 *
 * If projectedPayroll <= salaryCap → allow imbalance.
 * Else → incomingSalary <= outgoingSalary * (1 + matchingPercent).
 *
 * Zero outgoing / zero incoming → pass.
 * Zero outgoing / positive incoming while over cap → fail.
 */
export function applyTradeSalaryRule(
  input: TradeSalaryInputs,
): TradeSalaryRuleResult {
  const salaryCap = input.salaryCap ?? DEFAULT_SALARY_CAP;
  const matchingPercent =
    input.matchingPercent ?? TRADE_SALARY_MATCHING_PERCENT;
  const projectedPayroll =
    input.currentPayroll - input.outgoingSalary + input.incomingSalary;

  if (projectedPayroll <= salaryCap) {
    return { valid: true, projectedPayroll };
  }

  const maxIncoming = input.outgoingSalary * (1 + matchingPercent);
  if (input.incomingSalary <= maxIncoming) {
    return { valid: true, projectedPayroll };
  }

  return {
    valid: false,
    projectedPayroll,
    reason: `Incoming salary ${input.incomingSalary} exceeds matched max ${maxIncoming} while projected payroll ${projectedPayroll} is over cap ${salaryCap}.`,
  };
}
