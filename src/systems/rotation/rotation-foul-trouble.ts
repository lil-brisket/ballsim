/**
 * Foul trouble tiers and foul-out detection.
 */

import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";

export type FoulTroubleLevel =
  | "none"
  | "caution"
  | "trouble"
  | "severe"
  | "fouled_out";

export function isFouledOut(personalFouls: number): boolean {
  return personalFouls >= ROTATION_CONFIG.personalFoulLimit;
}

/**
 * Period is 1-based regulation; overtime uses period >= 5.
 */
export function foulTroubleLevel(
  personalFouls: number,
  periodNumber: number,
): FoulTroubleLevel {
  if (isFouledOut(personalFouls)) {
    return "fouled_out";
  }
  if (personalFouls <= 0) {
    return "none";
  }

  const tiers = ROTATION_CONFIG.foulTroubleTiers;
  if (periodNumber <= 1 && personalFouls >= tiers.period1) {
    return personalFouls >= 3 ? "severe" : "trouble";
  }
  if (periodNumber === 2 && personalFouls >= tiers.period2) {
    return personalFouls >= 4 ? "severe" : "trouble";
  }
  if (periodNumber === 3 && personalFouls >= tiers.period3Early) {
    return "severe";
  }
  if (periodNumber >= 4 && personalFouls >= tiers.period4) {
    return "severe";
  }
  if (personalFouls >= 3) {
    return "caution";
  }
  return "none";
}

/** Priority penalty applied to substitution scoring (higher = more likely to sit). */
export function foulTroubleSitScore(level: FoulTroubleLevel): number {
  switch (level) {
    case "fouled_out":
      return 1000;
    case "severe":
      return 8;
    case "trouble":
      return 4;
    case "caution":
      return 1.5;
    case "none":
    default:
      return 0;
  }
}
