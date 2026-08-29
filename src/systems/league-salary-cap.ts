import type { GameSettings } from "@/domain/game-settings";
import type { GameState } from "@/state/game-state";
import { DEFAULT_SALARY_CAP } from "@/systems/salary-cap-config";

/** Authoritative player salary cap from league settings. */
export function getLeagueSalaryCapFromSettings(settings: GameSettings): number {
  const value = settings.financialRules.salaryCap;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return DEFAULT_SALARY_CAP;
}

/** Authoritative player salary cap for the save's league. */
export function getLeagueSalaryCap(state: GameState): number {
  return getLeagueSalaryCapFromSettings(state.settings);
}
