import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { projectCashHorizon } from "@/systems/cash-projection";
import {
  calculateFinancialHealth,
  isCapitalSpendingRestricted,
  type FinancialHealthInput,
} from "@/systems/financial-health";

export function financialHealthInputFromState(
  state: GameState,
  teamId: string,
): FinancialHealthInput {
  const projection = projectCashHorizon(state, teamId);
  return {
    cash: state.business.finances[teamId]?.cash ?? 0,
    weeklyOutflow: projection.weeklyOutflow,
    netWeeklyBurn: projection.netWeeklyBurn,
    runwayWeeks: projection.runwayWeeks,
    projectedCash: projection.projectedCash,
  };
}

export function assertCapitalSpendingAllowed(
  state: GameState,
  teamId: TeamId,
  action: string,
): void {
  if (state.user.controlledTeamId !== teamId) {
    return;
  }
  const input = financialHealthInputFromState(state, teamId);
  if (!isCapitalSpendingRestricted(input)) {
    return;
  }
  const health = calculateFinancialHealth(input);
  throw new Error(
    `${action} is blocked while franchise finances are ${health} (projected cash at horizon: ${input.projectedCash ?? "n/a"}). Cut spending or wait for incoming revenue.`,
  );
}
