import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isOwnedFranchise } from "@/state/owner-context";
import { projectBusinessFundsHorizon } from "@/systems/cash-projection";
import {
  calculateBusinessHealth,
  type BusinessHealthInput,
  type FinancialHealthInput,
} from "@/systems/financial-health";
import { isDiscretionarySpendingFrozen } from "@/systems/board-pressure";
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
 * Blocks discretionary spend while the board has frozen it (see
 * board-pressure.ts). Funds are checked by callers that know the cost;
 * no insolvency / runway health gates.
 */
export function assertCapitalSpendingAllowed(
  state: GameState,
  teamId: TeamId,
  action: string,
): void {
  if (!isOwnedFranchise(state, teamId)) {
    return;
  }
  if (isDiscretionarySpendingFrozen(state, teamId)) {
    throw new Error(
      `${action} is frozen: the board has restricted discretionary spending.`,
    );
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
