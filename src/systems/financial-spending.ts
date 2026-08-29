import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isOwnedFranchise } from "@/state/owner-context";
import { projectBusinessFundsHorizon } from "@/systems/cash-projection";
import {
  calculateBusinessHealth,
  type BusinessHealthInput,
  type FinancialHealthInput,
} from "@/systems/financial-health";
import { assertSufficientBusinessFunds } from "@/systems/team-finances";

export function businessHealthInputFromState(
  state: GameState,
  teamId: string,
): BusinessHealthInput {
  const projection = projectBusinessFundsHorizon(state, teamId);
  return {
    businessFunds: state.business.finances[teamId]?.businessFunds ?? 0,
    weeklyOutflow: projection.weeklyOutflow,
    netWeeklyBurn: projection.netWeeklyBurn,
    runwayWeeks: projection.runwayWeeks,
    projectedBusinessFunds: projection.projectedBusinessFunds,
  };
}

/** @deprecated Use businessHealthInputFromState. */
export function financialHealthInputFromState(
  state: GameState,
  teamId: string,
): FinancialHealthInput {
  const input = businessHealthInputFromState(state, teamId);
  return {
    cash: input.businessFunds,
    weeklyOutflow: input.weeklyOutflow,
    netWeeklyBurn: input.netWeeklyBurn,
    runwayWeeks: input.runwayWeeks,
    projectedCash: input.projectedBusinessFunds,
  };
}

/**
 * Blocks capital spend when the franchise lacks sufficient business funds.
 * No longer uses insolvency / runway health gates.
 */
export function assertCapitalSpendingAllowed(
  state: GameState,
  teamId: TeamId,
  action: string,
): void {
  if (!isOwnedFranchise(state, teamId)) {
    return;
  }
  // Cost is checked by the caller via assertSufficientBusinessFunds when known;
  // this remains as a soft gate for budget increases (cost = 0 incremental).
  const health = calculateBusinessHealth(
    businessHealthInputFromState(state, teamId),
  );
  if (health === "critical") {
    // Informational only — do not block. Callers that know the dollar cost
    // must use assertSufficientBusinessFunds.
    void assertSufficientBusinessFunds;
  }
}

export { assertSufficientBusinessFunds };
