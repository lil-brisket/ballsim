import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";
import { findTeamStaffByRole } from "@/systems/staff-effects/find";
import {
  GM_TRADE_THRESHOLD_PER_QUALITY_POINT,
} from "@/systems/staff-config";
import { averageAttrs, diminishAbove } from "@/systems/staff-effects/shared";

/**
 * GM trade acceptance threshold. Better evaluation attrs lower the bar
 * for accepting slightly negative net-value trades (existing behavior preserved).
 */
export function gmTradeAcceptanceThreshold(
  state: GameState,
  teamId: TeamId,
): number {
  const gm = findTeamStaffByRole(state, teamId, "general_manager");
  if (!gm) return 0;
  const attrs = gm.attributes as Record<string, number>;
  const evalScore = diminishAbove(
    averageAttrs(attrs, [
      "tradeNegotiation",
      "assetValuation",
      "playerEvaluation",
    ]),
    85,
  );
  return -(evalScore - 50) * GM_TRADE_THRESHOLD_PER_QUALITY_POINT;
}
