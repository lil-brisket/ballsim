/**
 * Target-minute balancing as ONE scoring factor among many — not dominant.
 */

import type { RotationEntry } from "@/domain/entities/team-roster-management";
import type { RotationGameContext } from "@/systems/rotation/rotation-game-context";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";

/**
 * Pace-adjusted minutes deficit (positive = behind target).
 * Includes OT target adjustment from context.
 */
export function minutesDeficit(input: {
  entry: RotationEntry;
  actualMinutes: number;
  elapsedGameSeconds: number;
  context: RotationGameContext;
}): number {
  const regulationSeconds =
    ROTATION_CONFIG.regulationMinutes * 60;
  const effectiveTarget =
    input.entry.targetMinutes +
    (input.context.isOvertime ? input.context.targetMinutesAdjustment : 0) +
    input.entry.minutePriorityBias * 2;

  const pace = Math.max(
    input.elapsedGameSeconds / Math.max(regulationSeconds, 1),
    0.01,
  );
  // In OT, pace can exceed 1 — still useful for relative comparison
  const expected = effectiveTarget * Math.min(pace, 1.25);
  return expected - input.actualMinutes;
}

export function effectiveMaximum(
  entry: RotationEntry,
  context: RotationGameContext,
  medicalMaximumMpg?: number | null,
): number {
  let max =
    context.maximumOverridePolicy === "absolute"
      ? entry.absoluteMaximumMinutes
      : entry.normalMaximumMinutes;
  if (
    medicalMaximumMpg != null &&
    entry.overrideMedicalRecommendation !== true
  ) {
    max = Math.min(max, medicalMaximumMpg);
  }
  return max;
}

/**
 * Score contribution for putting a player IN (higher = more deserving of minutes).
 * Intentionally capped so deficit cannot dominate fatigue / foul / situation.
 */
export function minuteBalanceInScore(input: {
  entry: RotationEntry;
  actualMinutes: number;
  elapsedGameSeconds: number;
  context: RotationGameContext;
  remainingGameMinutes: number;
  medicalMaximumMpg?: number | null;
  medicalRecommendedMpg?: number | null;
}): number {
  const deficit = minutesDeficit(input);
  const max = effectiveMaximum(
    input.entry,
    input.context,
    input.medicalMaximumMpg,
  );
  const room = max - input.actualMinutes;

  if (room <= 0) {
    return -10;
  }

  // Soft floor: behind minimum with time remaining
  const underMinimum =
    input.actualMinutes < input.entry.minimumMinutes &&
    input.remainingGameMinutes > 2
      ? 2
      : 0;

  // Cap deficit influence — deficit of 8 minutes ≈ score of ~3, not 8
  let cappedDeficit = Math.max(-4, Math.min(4, deficit * 0.4));

  // Soft penalty above medical recommendation
  if (
    input.medicalRecommendedMpg != null &&
    input.entry.overrideMedicalRecommendation !== true &&
    input.actualMinutes >= input.medicalRecommendedMpg
  ) {
    cappedDeficit -= 2;
  }

  // Blowout lead: reduce urgency to chase star targets; boost deep bench
  const blowoutDamp =
    input.context.situation === "blowout_lead" ? 0.5 : 1;
  const blowoutBenchBoost =
    (input.context.situation === "blowout_lead" ||
      input.context.situation === "blowout_deficit") &&
    (input.entry.role === "bench" ||
      input.entry.role === "deep_bench" ||
      input.entry.role === "emergency")
      ? 3
      : 0;

  // Priority: lower number = higher priority → slight boost
  const priorityBoost = (6 - input.entry.rotationPriority) * 0.35;

  return (
    (cappedDeficit + underMinimum + priorityBoost) * blowoutDamp +
    blowoutBenchBoost
  );
}

/**
 * Score contribution for taking a player OUT (higher = more likely to sit).
 */
export function minuteBalanceOutScore(input: {
  entry: RotationEntry;
  actualMinutes: number;
  elapsedGameSeconds: number;
  context: RotationGameContext;
}): number {
  const deficit = minutesDeficit(input);
  const max = effectiveMaximum(input.entry, input.context);
  const overNormal = input.actualMinutes - input.entry.normalMaximumMinutes;
  const overAbs = input.actualMinutes - input.entry.absoluteMaximumMinutes;

  let score = 0;
  if (overAbs >= 0) {
    score += 20;
  } else if (overNormal >= 0 && input.context.maximumOverridePolicy === "normal") {
    score += 6 + overNormal;
  } else if (deficit < -2) {
    // Ahead of target pace
    score += Math.min(4, -deficit * 0.35);
  }

  // Blowout: sit starters who are ahead of target
  if (
    input.context.situation === "blowout_lead" &&
    input.entry.role === "starter" &&
    deficit < 0
  ) {
    score += 3;
  }

  return score;
}
