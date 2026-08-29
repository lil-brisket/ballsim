import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

/**
 * Initial weekly amortization divisor (legacy). Player payroll is now a
 * commitment against the league salary cap — it does not drain business funds.
 */
export const PLAYER_PAYROLL_WEEKS_PER_YEAR = 52;

/**
 * No-op: player payroll does not mutate business funds.
 * Kept for weekly pipeline compatibility.
 */
export function processWeeklyPlayerPayroll(state: GameState): SystemResult {
  void (null as unknown as TeamId);
  return systemResult(state);
}
