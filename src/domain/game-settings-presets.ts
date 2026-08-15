/**
 * UI helpers that produce GameSettings. Preset ids are not persisted.
 */

import {
  CBL_GAME_SETTINGS,
  cloneGameSettings,
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
} from "@/domain/game-settings";

export type LeagueSetupPresetId = "standard" | "cbl" | "custom";

export const LEAGUE_SETUP_PRESET_IDS: readonly LeagueSetupPresetId[] = [
  "standard",
  "cbl",
  "custom",
] as const;

export function settingsForPreset(
  presetId: LeagueSetupPresetId,
  customBase?: GameSettings,
): GameSettings {
  switch (presetId) {
    case "standard":
      return cloneGameSettings(DEFAULT_GAME_SETTINGS);
    case "cbl":
      return cloneGameSettings(CBL_GAME_SETTINGS);
    case "custom":
      return cloneGameSettings(customBase ?? DEFAULT_GAME_SETTINGS);
    default: {
      const _exhaustive: never = presetId;
      throw new Error(`Unknown league setup preset: ${_exhaustive}`);
    }
  }
}

export function resetSettingsForPreset(
  presetId: LeagueSetupPresetId,
): GameSettings {
  if (presetId === "custom") {
    return cloneGameSettings(DEFAULT_GAME_SETTINGS);
  }
  return settingsForPreset(presetId);
}
