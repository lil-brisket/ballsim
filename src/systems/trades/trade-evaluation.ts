import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { TRADE_BLOCK_VALUE_BONUS } from "@/systems/trades-config";
import { calculateDraftPickValue } from "@/systems/trades/draft-pick-value";
import { getTradeBlock } from "@/systems/trades/trade-block";
import { gmTradeAcceptanceThreshold } from "@/systems/staff-effects";
import {
  resolveFranchisePreferences,
  type EffectivePreferences,
} from "@/systems/franchise-ai-preferences";
import {
  AI_VETERAN_AGE_MIN,
  AI_YOUTH_AGE_MAX,
  boundedPreferenceMultiplier,
  PREFERENCE_VALUE_MODIFIER_BAND,
} from "@/systems/franchise-ai-preferences-config";

export type TradeOfferEvaluation = {
  accepted: boolean;
  netValue: number;
  incomingValue: number;
  outgoingValue: number;
  tradeBlockBonus: number;
  /** Objective net before organizational preference adjustment. */
  objectiveNetValue?: number;
};

/**
 * Deterministic AI acceptance: accept iff organizational netValue >= threshold.
 * Objective player/pick value is computed first; a single bounded preference
 * modifier adjusts that franchise's valuation. Legality remains validateTrade's job.
 */
export function evaluateTradeOffer(
  state: GameState,
  evaluatingTeamId: TeamId,
  proposal: TradeProposal,
): TradeOfferEvaluation {
  const { incomingPlayerIds, outgoingPlayerIds, incomingPickIds, outgoingPickIds } =
    assetsFromPerspective(evaluatingTeamId, proposal);

  const resolved = resolveFranchisePreferences(state, evaluatingTeamId);
  const prefs = resolved?.preferences;

  let incomingValue = 0;
  let outgoingValue = 0;

  for (const playerId of incomingPlayerIds) {
    incomingValue += organizationalPlayerValue(state, playerId, prefs);
  }
  for (const playerId of outgoingPlayerIds) {
    outgoingValue += organizationalPlayerValue(state, playerId, prefs);
  }
  for (const pickId of incomingPickIds) {
    incomingValue += organizationalPickValue(state, pickId, prefs);
  }
  for (const pickId of outgoingPickIds) {
    outgoingValue += organizationalPickValue(state, pickId, prefs);
  }

  const block = getTradeBlock(state, evaluatingTeamId);
  let tradeBlockBonus = 0;
  for (const playerId of incomingPlayerIds) {
    if (
      block.assets.some(
        (asset) => asset.kind === "player" && asset.playerId === playerId,
      )
    ) {
      tradeBlockBonus += TRADE_BLOCK_VALUE_BONUS;
    }
  }
  for (const pickId of incomingPickIds) {
    if (
      block.assets.some(
        (asset) => asset.kind === "draftPick" && asset.draftPickId === pickId,
      )
    ) {
      tradeBlockBonus += TRADE_BLOCK_VALUE_BONUS;
    }
  }

  const objectiveIncoming =
    incomingPlayerIds.reduce((s, id) => s + objectivePlayerValue(state, id), 0) +
    incomingPickIds.reduce((s, id) => s + objectivePickValue(state, id), 0);
  const objectiveOutgoing =
    outgoingPlayerIds.reduce((s, id) => s + objectivePlayerValue(state, id), 0) +
    outgoingPickIds.reduce((s, id) => s + objectivePickValue(state, id), 0);
  const objectiveNetValue =
    objectiveIncoming + tradeBlockBonus - objectiveOutgoing;

  const netValue = incomingValue + tradeBlockBonus - outgoingValue;
  const threshold = gmTradeAcceptanceThreshold(state, evaluatingTeamId);
  return {
    accepted: netValue >= threshold,
    netValue,
    incomingValue,
    outgoingValue,
    tradeBlockBonus,
    objectiveNetValue,
  };
}

function assetsFromPerspective(
  evaluatingTeamId: TeamId,
  proposal: TradeProposal,
): {
  incomingPlayerIds: PlayerId[];
  outgoingPlayerIds: PlayerId[];
  incomingPickIds: DraftPickId[];
  outgoingPickIds: DraftPickId[];
} {
  if (proposal.sideA.teamId === evaluatingTeamId) {
    return {
      outgoingPlayerIds: proposal.sideA.playerIds,
      outgoingPickIds: proposal.sideA.draftPickIds,
      incomingPlayerIds: proposal.sideB.playerIds,
      incomingPickIds: proposal.sideB.draftPickIds,
    };
  }
  if (proposal.sideB.teamId === evaluatingTeamId) {
    return {
      outgoingPlayerIds: proposal.sideB.playerIds,
      outgoingPickIds: proposal.sideB.draftPickIds,
      incomingPlayerIds: proposal.sideA.playerIds,
      incomingPickIds: proposal.sideA.draftPickIds,
    };
  }
  throw new Error(
    `Evaluating team "${evaluatingTeamId}" is not a party to the proposal.`,
  );
}

function objectivePlayerValue(state: GameState, playerId: PlayerId): number {
  const player = state.world.players[playerId];
  if (player === undefined) {
    return 0;
  }
  return calculatePlayerOverall(player.position, player.attributes);
}

function objectivePickValue(state: GameState, pickId: DraftPickId): number {
  const pick = state.world.draftPicks[pickId];
  if (pick === undefined) {
    return 0;
  }
  return calculateDraftPickValue(pick);
}

/**
 * One bounded organizational adjustment of objective player value.
 * Uses youth / established / win-now pressures — not a stack of risk multipliers.
 */
export function organizationalPlayerValue(
  state: GameState,
  playerId: PlayerId,
  prefs: EffectivePreferences | undefined,
): number {
  const objective = objectivePlayerValue(state, playerId);
  if (!prefs || objective === 0) {
    return objective;
  }
  const player = state.world.players[playerId];
  if (!player) {
    return objective;
  }
  let preference01 = 0.5;
  if (player.age <= AI_YOUTH_AGE_MAX) {
    preference01 = prefs.youthValue;
  } else if (player.age >= AI_VETERAN_AGE_MIN) {
    preference01 =
      prefs.establishedPlayerValue * 0.7 + prefs.winNowPressure * 0.3;
  } else {
    preference01 =
      prefs.establishedPlayerValue * 0.4 +
      prefs.youthValue * 0.3 +
      prefs.winNowPressure * 0.3;
  }
  return objective * boundedPreferenceMultiplier(preference01);
}

/** Draft-asset strategy: preference adjusts pick valuation (not prospect sort). */
export function organizationalPickValue(
  state: GameState,
  pickId: DraftPickId,
  prefs: EffectivePreferences | undefined,
): number {
  const objective = objectivePickValue(state, pickId);
  if (!prefs || objective === 0) {
    return objective;
  }
  return (
    objective *
    boundedPreferenceMultiplier(prefs.pickValue, PREFERENCE_VALUE_MODIFIER_BAND)
  );
}
