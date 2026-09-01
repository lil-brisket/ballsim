import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";
import type { StrategicPosture } from "@/systems/franchise-strategic-posture";
import { getTeamCapSpace } from "@/systems/salary-cap";
import { getContractSalaryForYear } from "@/domain/entities/contract";
import {
  STRATEGIC_POSTURE_ADJUSTMENTS,
  TEAM_FIT_ADJUSTMENT_BANDS,
  TRADE_BLOCK_VALUE_BONUS,
  AGE_VALUE_MODIFIERS,
} from "@/systems/trades-config";
import { getTradeBlock } from "@/systems/trades/trade-block";
import { getBaseAssetValue } from "@/systems/trades/asset-valuation/base-asset-value";
import {
  calculateTradeNeeds,
  tradeNeedLevelScore,
} from "@/systems/trades/trade-needs";
import type {
  AssetValueResult,
  TradeAssetRef,
} from "@/systems/trades/asset-valuation/types";

/**
 * Team-specific asset value = base + bounded additive adjustments.
 * Deterministic — no RNG.
 */
export function getTeamAssetValue(
  state: GameState,
  teamId: TeamId,
  asset: TradeAssetRef,
): AssetValueResult {
  const base = getBaseAssetValue(state, asset);
  if (base.value <= 0) {
    return base;
  }

  const reasons = [...base.reasons];
  let rosterFit = 0;
  let strategicFit = 0;
  let contractAdj = 0;
  let financialAdj = 0;

  const resolved = resolveFranchisePreferences(state, teamId);
  const posture: StrategicPosture = resolved?.posture ?? "maintaining";

  if (asset.kind === "player") {
    const player = state.world.players[asset.playerId];
    if (player) {
      const needs = calculateTradeNeeds(state, teamId);
      const pos = needs.byPosition.find((p) => p.position === player.position);
      if (pos) {
        const needScore = tradeNeedLevelScore(pos.level);
        if (needScore >= tradeNeedLevelScore("major")) {
          rosterFit += 8 + needScore;
          reasons.push(`Team has a positional need at ${player.position}`);
        } else if (pos.surplus) {
          rosterFit -= 6;
          reasons.push(`Surplus at ${player.position}`);
        }
      }

      const overall = calculatePlayerOverall(player.position, player.attributes);
      const adj = postureAdjustments(posture, player.age, "player");
      strategicFit += adj;
      if (adj >= 5) {
        reasons.push(postureReason(posture, player.age));
      }

      if (player.contractId) {
        const year = state.competition.season.year;
        const contract = state.business.contracts[player.contractId];
        const salary = contract
          ? (getContractSalaryForYear(contract, year) ?? 0)
          : 0;
        const capSpace = getTeamCapSpace(teamId, year, state);
        if (capSpace < 0 && salary > overall * 200_000) {
          contractAdj -= 6;
          financialAdj -= 4;
          reasons.push("Salary pressure for over-cap team");
        }
      }

      const block = getTradeBlock(state, teamId);
      if (
        block.assets.some(
          (a) => a.kind === "player" && a.playerId === asset.playerId,
        )
      ) {
        rosterFit += TRADE_BLOCK_VALUE_BONUS * 0.4;
      }
    }
  } else {
    const pickAdj = postureAdjustments(posture, null, "pick");
    strategicFit += pickAdj;
    if (pickAdj >= 5) {
      reasons.push("Fits future-asset strategy");
    }
    const block = getTradeBlock(state, teamId);
    if (
      block.assets.some(
        (a) =>
          a.kind === "draftPick" && a.draftPickId === asset.draftPickId,
      )
    ) {
      rosterFit += TRADE_BLOCK_VALUE_BONUS * 0.4;
    }
  }

  rosterFit = clamp(
    rosterFit,
    TEAM_FIT_ADJUSTMENT_BANDS.rosterFitMin,
    TEAM_FIT_ADJUSTMENT_BANDS.rosterFitMax,
  );
  strategicFit = clamp(
    strategicFit,
    TEAM_FIT_ADJUSTMENT_BANDS.strategicFitMin,
    TEAM_FIT_ADJUSTMENT_BANDS.strategicFitMax,
  );
  contractAdj = clamp(
    contractAdj,
    TEAM_FIT_ADJUSTMENT_BANDS.contractMin,
    TEAM_FIT_ADJUSTMENT_BANDS.contractMax,
  );
  financialAdj = clamp(
    financialAdj,
    TEAM_FIT_ADJUSTMENT_BANDS.financialMin,
    TEAM_FIT_ADJUSTMENT_BANDS.financialMax,
  );

  const value =
    Math.round(
      (base.value + rosterFit + strategicFit + contractAdj + financialAdj) *
        10,
    ) / 10;

  return { value, reasons };
}

function postureAdjustments(
  posture: StrategicPosture,
  age: number | null,
  kind: "player" | "pick",
): number {
  const table =
    STRATEGIC_POSTURE_ADJUSTMENTS[posture] ??
    STRATEGIC_POSTURE_ADJUSTMENTS.maintaining;
  if (kind === "pick") {
    return table.pick;
  }
  if (age === null) return 0;
  if (age <= AGE_VALUE_MODIFIERS.youthMaxAge) return table.youth;
  if (age >= 30) return table.veteran;
  return Math.round((table.youth + table.veteran) / 4);
}

function postureReason(posture: StrategicPosture, age: number): string {
  if (
    (posture === "rebuilding" || posture === "developing") &&
    age <= AGE_VALUE_MODIFIERS.youthMaxAge
  ) {
    return "Strong fit for rebuilding timeline";
  }
  if (
    (posture === "contending" || posture === "all_in") &&
    age >= 26 &&
    age <= 32
  ) {
    return "Strong fit for contender";
  }
  return `Aligned with ${posture.replace("_", " ")} posture`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
