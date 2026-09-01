import {
  getContractSalaryForYear,
  getContractStatus,
} from "@/domain/entities/contract";
import type { DraftPick } from "@/domain/entities/draft-pick";
import type { Player } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { DraftPickId, PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  AGE_VALUE_MODIFIERS,
  CONTRACT_VALUE_MODIFIERS,
  DRAFT_PICK_VALUE_ROUND_1,
  DRAFT_PICK_VALUE_ROUND_2,
  INJURY_PENALTIES,
  PLAYER_TRADE_VALUE_WEIGHTS,
  RECENT_PERFORMANCE_WEIGHT,
} from "@/systems/trades-config";
import {
  pickValueFromProjection,
  projectDraftPick,
  tierDisplayLabel,
} from "@/systems/trades/asset-valuation/pick-projection";
import type {
  AssetValueResult,
  TradeAssetRef,
} from "@/systems/trades/asset-valuation/types";

/**
 * League-wide base asset value. Deterministic — no RNG.
 */
export function getBaseAssetValue(
  state: GameState,
  asset: TradeAssetRef,
): AssetValueResult {
  if (asset.kind === "player") {
    return basePlayerValue(state, asset.playerId);
  }
  return basePickValue(state, asset.draftPickId);
}

function basePlayerValue(state: GameState, playerId: PlayerId): AssetValueResult {
  const player = state.world.players[playerId];
  if (!player) {
    return { value: 0, reasons: ["Unknown player"] };
  }

  const overall = calculatePlayerOverall(player.position, player.attributes);
  const reasons: string[] = [];
  const w = PLAYER_TRADE_VALUE_WEIGHTS;

  const ability = overall;
  const potentialGap = player.potential.overall - overall;
  const potential =
    overall + Math.max(-8, Math.min(15, potentialGap * 0.55));
  if (potentialGap >= 8) {
    reasons.push("High upside remaining");
  } else if (potentialGap <= -3) {
    reasons.push("Limited remaining upside");
  }

  const ageCurve = ageCurveValue(player, overall, reasons);
  const performance = performanceValue(state, player, overall, reasons);
  const trajectory = trajectoryValue(player, potentialGap, reasons);
  const contract = contractValue(state, player, overall, reasons);
  const injury = injuryValue(player, overall, reasons);

  const value =
    ability * w.ability +
    potential * w.potential +
    ageCurve * w.ageCurve +
    performance * w.performance +
    trajectory * w.trajectory +
    contract * w.contract +
    injury * w.injury;

  if (player.developmentLeague.status === "assigned") {
    reasons.push("Development-league assignment");
  }

  return { value: Math.round(value * 10) / 10, reasons };
}

function basePickValue(state: GameState, pickId: DraftPickId): AssetValueResult {
  const pick = state.world.draftPicks[pickId];
  if (!pick || pick.status !== "available") {
    return { value: 0, reasons: ["Unavailable pick"] };
  }

  const year = state.competition.season.year;
  const projection = projectDraftPick(state, pick);
  const value = pickValueFromProjection(projection, pick, year);
  const reasons: string[] = [
    tierDisplayLabel(projection.tier),
    `Projects around #${projection.projectedOverallPick} (range #${projection.rangeLow}–#${projection.rangeHigh})`,
  ];
  if (projection.confidence === "low") {
    reasons.push("High projection uncertainty");
  }
  if (projection.tier === "strong_lottery" || projection.tier === "likely_lottery") {
    reasons.push("High lottery potential");
  }
  if (pick.round === 2) {
    reasons.push("Second-round pick");
  }

  // Soft floor near legacy constants so mid-pack R1 stays near 80.
  const floor =
    pick.round === 1 ? DRAFT_PICK_VALUE_ROUND_1 * 0.55 : DRAFT_PICK_VALUE_ROUND_2 * 0.55;
  return {
    value: Math.round(Math.max(floor, value) * 10) / 10,
    reasons,
  };
}

function ageCurveValue(
  player: Player,
  overall: number,
  reasons: string[],
): number {
  const { youthMaxAge, primeMaxAge, youthBonus, primeBonus, declinePenalty } =
    AGE_VALUE_MODIFIERS;
  if (player.age <= youthMaxAge) {
    reasons.push("Young age curve");
    return overall + youthBonus;
  }
  if (player.age <= primeMaxAge) {
    return overall + primeBonus;
  }
  reasons.push("Aging / declining window");
  return overall + declinePenalty;
}

function performanceValue(
  state: GameState,
  player: Player,
  overall: number,
  reasons: string[],
): number {
  const { games, seasonPts, recentPts } = collectPerformance(state, player.id);
  const expected =
    overall * RECENT_PERFORMANCE_WEIGHT.expectedPtsPerOvr;
  if (games === 0) {
    return overall;
  }

  const seasonPpg = seasonPts / games;
  let recentWeight = 0;
  if (games >= RECENT_PERFORMANCE_WEIGHT.minGamesForRecent) {
    if (games <= RECENT_PERFORMANCE_WEIGHT.limitedGames) {
      recentWeight = RECENT_PERFORMANCE_WEIGHT.limitedRecentWeight;
    } else {
      recentWeight = RECENT_PERFORMANCE_WEIGHT.fullRecentWeight;
    }
  }
  const seasonWeight = 1 - recentWeight;
  const blended =
    seasonPpg * seasonWeight +
    (recentPts > 0 && recentWeight > 0
      ? recentPts * recentWeight
      : seasonPpg * recentWeight);

  const delta = blended - expected;
  if (delta <= -3 && games >= RECENT_PERFORMANCE_WEIGHT.minGamesForRecent) {
    reasons.push("Recent production below expectations");
  } else if (delta >= 3 && games >= RECENT_PERFORMANCE_WEIGHT.minGamesForRecent) {
    reasons.push("Sustained overperformance");
  }

  // Bound performance swing so it cannot override ability/age/potential.
  const adj = Math.max(-10, Math.min(10, delta * 1.4));
  return overall + adj;
}

function collectPerformance(
  state: GameState,
  playerId: PlayerId,
): { games: number; seasonPts: number; recentPts: number } {
  const rows: number[] = [];
  for (const game of Object.values(state.competition.games)) {
    if (game.status !== "final") continue;
    const row = game.playerStats.find((stat) => stat.playerId === playerId);
    if (!row) continue;
    rows.push(row.points);
  }
  const games = rows.length;
  const seasonPts = rows.reduce((a, b) => a + b, 0);
  const window = RECENT_PERFORMANCE_WEIGHT.rollingWindow;
  const recent = rows.slice(-window);
  const recentPts =
    recent.length > 0
      ? recent.reduce((a, b) => a + b, 0) / recent.length
      : 0;
  return { games, seasonPts, recentPts };
}

function trajectoryValue(
  player: Player,
  potentialGap: number,
  reasons: string[],
): number {
  const overall = calculatePlayerOverall(player.position, player.attributes);
  if (player.development.stage === "developing" && potentialGap > 0) {
    reasons.push("Ascending development trajectory");
    return overall + 5;
  }
  if (player.development.stage === "declining") {
    reasons.push("Declining development stage");
    return overall - 6;
  }
  return overall;
}

function contractValue(
  state: GameState,
  player: Player,
  overall: number,
  reasons: string[],
): number {
  if (!player.contractId) {
    return overall;
  }
  const contract = state.business.contracts[player.contractId];
  if (!contract) {
    return overall;
  }
  const year = state.competition.season.year;
  if (getContractStatus(contract, year) !== "active") {
    return overall;
  }
  const salary = getContractSalaryForYear(contract, year) ?? 0;
  const fair = overall * CONTRACT_VALUE_MODIFIERS.fairSalaryPerOvr;
  const surplusMillions = (salary - fair) / 1_000_000;
  let adj = 0;
  if (surplusMillions > 1) {
    adj -= surplusMillions * CONTRACT_VALUE_MODIFIERS.overpaidPenaltyPerMillion;
    reasons.push("Long-term contract reduces value");
  } else if (surplusMillions < -1) {
    adj +=
      Math.abs(surplusMillions) *
      CONTRACT_VALUE_MODIFIERS.underpaidBonusPerMillion;
    reasons.push("Favorable contract value");
  }
  const yearsLeft = Math.max(0, contract.endYear - year + 1);
  if (
    yearsLeft >= CONTRACT_VALUE_MODIFIERS.longDealYearsThreshold &&
    surplusMillions > 2
  ) {
    adj -= CONTRACT_VALUE_MODIFIERS.longDealOverpaidExtra;
  }
  return overall + adj;
}

function injuryValue(
  player: Player,
  overall: number,
  reasons: string[],
): number {
  let penalty = 0;
  for (const injury of player.activeInjuries) {
    const restriction = injury.gameRestriction;
    if (restriction === "out") {
      penalty = Math.max(penalty, INJURY_PENALTIES.out);
    } else if (restriction === "limited") {
      penalty = Math.max(penalty, INJURY_PENALTIES.limited);
    } else if (restriction === "monitor") {
      penalty = Math.max(penalty, INJURY_PENALTIES.monitor);
    }
  }
  if (penalty > 0) {
    reasons.push("Injury status reduces trade value");
  }
  return overall - penalty;
}

/** Convenience for callers that already have a DraftPick entity. */
export function getBasePickValueFromEntity(
  state: GameState,
  pick: DraftPick,
): AssetValueResult {
  return basePickValue(state, pick.id);
}
