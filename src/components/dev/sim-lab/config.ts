import type { LabLeaguePreset } from "@/simulation/lab/lab-league-preset";

export type SimLabPresetOption = {
  id: LabLeaguePreset;
  label: string;
};

export type SimLabPageConfig = {
  scenarioIds: readonly string[];
  presets: readonly SimLabPresetOption[];
  maxGames: number;
  maxSeasonsCbl: number;
  maxSeasonsStandard: number;
};
