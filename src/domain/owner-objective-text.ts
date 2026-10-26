/**
 * Readable text for owner objectives, shared by objective creation
 * (systems), narrative situations and every view. Pure string formatting:
 * never feeds rules or RNG.
 */

/** Short money label: $98.8M, $726K, $950. */
export function formatMoney(amount: number): string {
  const millions = amount / 1_000_000;
  if (Math.abs(millions) >= 1) {
    return `$${millions.toFixed(1)}M`;
  }
  const thousands = amount / 1_000;
  if (Math.abs(thousands) >= 1) {
    return `$${thousands.toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

/** Objective types whose target and progress are dollar amounts. */
const MONEY_TYPES = new Set<string>([
  "payroll_limit",
  "revenue_target",
  "franchise_value",
  "improve_finances",
  "positive_cash",
]);

/** Objective types whose target and progress are percentages. */
const PERCENT_TYPES = new Set<string>(["attendance"]);

export function isMoneyObjectiveType(type: string): boolean {
  return MONEY_TYPES.has(type);
}

/** A target or progress value in the objective's unit. */
export function formatObjectiveValue(type: string, value: number): string {
  if (MONEY_TYPES.has(type)) return formatMoney(value);
  if (PERCENT_TYPES.has(type)) return `${value}%`;
  return value.toLocaleString("en-US");
}

/**
 * The objective's sentence. Money targets are written from the stored target
 * (older saves stored the raw number in `description`); everything else keeps
 * the stored description.
 */
export function describeOwnerObjective(objective: {
  type: string;
  description: string;
  target?: number | null;
}): string {
  const { type, target } = objective;
  if (target === null || target === undefined) return objective.description;
  if (type === "payroll_limit") {
    return `Keep payroll at or below ${formatMoney(target)}`;
  }
  if (type === "revenue_target") {
    return `Reach ${formatMoney(target)} in season revenue`;
  }
  return objective.description;
}
