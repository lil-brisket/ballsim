import {
  applyPreset,
  cloneGameSettings,
  CBL_GAME_SETTINGS,
  DEFAULT_GAME_SETTINGS,
  type GameSettings,
} from "@/domain/game-settings";

export const LAB_LEAGUE_PRESETS = ["cbl", "standard"] as const;

export type LabLeaguePreset = (typeof LAB_LEAGUE_PRESETS)[number];

export function isLabLeaguePreset(value: string): value is LabLeaguePreset {
  return (LAB_LEAGUE_PRESETS as readonly string[]).includes(value);
}

/**
 * League size / schedule length for Lab season and schedule runs.
 * Full management is applied so unattended advances are not blocked by
 * owner decisions.
 */
export function settingsForLabPreset(preset: LabLeaguePreset): GameSettings {
  const base = cloneGameSettings(
    preset === "standard" ? DEFAULT_GAME_SETTINGS : CBL_GAME_SETTINGS,
  );
  return {
    ...base,
    ai: {
      ...base.ai,
      managementPreset: "full_management",
      assistance: applyPreset("full_management"),
    },
  };
}

export function labPresetScheduleLabel(preset: LabLeaguePreset): string {
  return preset === "standard"
    ? "Standard · 30 teams · 82 games"
    : "CBL · 12 teams · 22 games";
}
