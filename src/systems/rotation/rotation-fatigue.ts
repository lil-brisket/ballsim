/**
 * Fatigue from stamina, continuous court time, and rest.
 */

import type { Player } from "@/domain/entities/player";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";

/**
 * Returns fatigue in [0, 1]. Higher = more tired.
 * Stamina attribute (1–99) slows accumulation.
 */
export function computeFatigue(input: {
  player: Player;
  continuousSecondsOnCourt: number;
  totalSecondsOnCourt: number;
  secondsSinceLastRest: number;
}): number {
  const stamina = Math.max(1, Math.min(99, input.player.attributes.stamina));
  const staminaFactor = 1.15 - stamina / 100; // high stamina → lower factor

  const continuousLoad =
    input.continuousSecondsOnCourt /
    Math.max(1, ROTATION_CONFIG.continuousStretchSeconds);
  const totalLoad = input.totalSecondsOnCourt / (48 * 60);
  const restRelief = Math.min(
    0.35,
    input.secondsSinceLastRest / 600,
  );

  const raw =
    continuousLoad * 0.55 * staminaFactor +
    totalLoad * 0.45 * staminaFactor -
    restRelief;

  return Math.max(0, Math.min(1, raw));
}

export function restReducesFatigue(
  currentFatigue: number,
  restSeconds: number,
): number {
  const relief = Math.min(0.5, restSeconds / 480);
  return Math.max(0, currentFatigue - relief);
}

export function isFatiguedForSubstitution(fatigue: number): boolean {
  return fatigue >= ROTATION_CONFIG.fatigueSubThreshold;
}
