/**
 * Legacy organizational preference multipliers — thin wrappers for callers
 * that still import organizationalPlayerValue / organizationalPickValue.
 */
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { DraftPickId, PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import type { EffectivePreferences } from "@/systems/franchise-ai-preferences";
import {
  AI_VETERAN_AGE_MIN,
  AI_YOUTH_AGE_MAX,
  boundedPreferenceMultiplier,
  PREFERENCE_VALUE_MODIFIER_BAND,
} from "@/systems/franchise-ai-preferences-config";
import { getBaseAssetValue } from "@/systems/trades/asset-valuation/base-asset-value";

export function organizationalPlayerValue(
  state: GameState,
  playerId: PlayerId,
  prefs: EffectivePreferences | undefined,
): number {
  const base = getBaseAssetValue(state, { kind: "player", playerId }).value;
  if (!prefs || base === 0) {
    return base;
  }
  const player = state.world.players[playerId];
  if (!player) {
    return base;
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
  return base * boundedPreferenceMultiplier(preference01);
}

export function organizationalPickValue(
  state: GameState,
  pickId: DraftPickId,
  prefs: EffectivePreferences | undefined,
): number {
  const base = getBaseAssetValue(state, {
    kind: "draftPick",
    draftPickId: pickId,
  }).value;
  if (!prefs || base === 0) {
    return base;
  }
  return (
    base *
    boundedPreferenceMultiplier(prefs.pickValue, PREFERENCE_VALUE_MODIFIER_BAND)
  );
}

/** @deprecated overall-only helper kept for tests that poke ability. */
export function legacyObjectivePlayerOverall(
  state: GameState,
  playerId: PlayerId,
): number {
  const player = state.world.players[playerId];
  if (!player) return 0;
  return calculatePlayerOverall(player.position, player.attributes);
}
