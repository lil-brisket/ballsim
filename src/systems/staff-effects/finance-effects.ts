import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";
import { findTeamStaffByRole } from "@/systems/staff-effects/find";
import { averageAttrs, clamp, diminishAbove } from "@/systems/staff-effects/shared";

/**
 * Finance Director — business efficiency ONLY.
 *
 * MUST NOT:
 * - create/borrow money
 * - increase salary cap / staff budget
 * - bypass contract limits
 * - directly modify businessFunds
 * - transfer business money into basketball ops
 *
 * MAY: bounded efficiency multipliers on business revenue/opex paths.
 */
export function financeRevenueEfficiencyMultiplier(
  state: GameState,
  teamId: TeamId,
): number {
  const finance = findTeamStaffByRole(state, teamId, "finance");
  if (!finance) return 1;
  const attrs = finance.attributes as Record<string, number>;
  const score = diminishAbove(
    averageAttrs(attrs, [
      "revenueEfficiency",
      "sponsorshipLeverage",
      "investmentJudgment",
    ]),
    85,
  );
  return clamp(1 + (score - 50) * 0.002, 0.92, 1.08);
}

export function financeOpexEfficiencyMultiplier(
  state: GameState,
  teamId: TeamId,
): number {
  const finance = findTeamStaffByRole(state, teamId, "finance");
  if (!finance) return 1;
  const attrs = finance.attributes as Record<string, number>;
  const score = diminishAbove(
    averageAttrs(attrs, ["costControl", "budgetForecasting", "compliance"]),
    85,
  );
  // Better cost control → lower opex multiplier (< 1)
  return clamp(1 - (score - 50) * 0.002, 0.92, 1.08);
}
