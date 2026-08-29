/**
 * Post-game explanations for target vs actual minute deltas.
 */

import type { RotationEntry } from "@/domain/entities/team-roster-management";
import type { FoulTroubleLevel } from "@/systems/rotation/rotation-foul-trouble";
import type { GameSituation } from "@/systems/rotation/rotation-game-context";

export type MinuteExplanationReason =
  | "foul_trouble"
  | "fouled_out"
  | "high_fatigue"
  | "bench_performed"
  | "close_game"
  | "overtime"
  | "late_game_usage"
  | "blowout_rest"
  | "injury"
  | "play_more_bias"
  | "play_less_bias"
  | "approached_maximum"
  | "below_minimum_soft";

const REASON_LABELS: Record<MinuteExplanationReason, string> = {
  foul_trouble: "Foul trouble",
  fouled_out: "Fouled out",
  high_fatigue: "High fatigue",
  bench_performed: "Bench unit received preferred minutes",
  close_game: "Close game",
  overtime: "Overtime",
  late_game_usage: "Increased late-game usage",
  blowout_rest: "Blowout — starters rested",
  injury: "Injury / unavailable",
  play_more_bias: "Play-more priority",
  play_less_bias: "Play-less priority",
  approached_maximum: "Approached maximum minutes",
  below_minimum_soft: "Could not reach minimum without breaking lineup",
};

export function reasonLabel(reason: MinuteExplanationReason): string {
  return REASON_LABELS[reason];
}

export function buildMinuteExplanations(input: {
  entry: RotationEntry;
  actualMinutes: number;
  fouledOut: boolean;
  peakFoulTrouble: FoulTroubleLevel;
  peakFatigue: number;
  situationsSeen: readonly GameSituation[];
  wasInjured: boolean;
}): string[] {
  const delta = input.actualMinutes - input.entry.targetMinutes;
  if (Math.abs(delta) < 4) {
    return [];
  }

  const reasons: MinuteExplanationReason[] = [];

  if (input.fouledOut) {
    reasons.push("fouled_out");
  } else if (
    input.peakFoulTrouble === "severe" ||
    input.peakFoulTrouble === "trouble"
  ) {
    reasons.push("foul_trouble");
  }

  if (input.peakFatigue >= 0.7) {
    reasons.push("high_fatigue");
  }

  if (input.wasInjured) {
    reasons.push("injury");
  }

  if (input.situationsSeen.includes("overtime") && delta > 0) {
    reasons.push("overtime");
  }
  if (
    (input.situationsSeen.includes("late_close") ||
      input.situationsSeen.includes("close")) &&
    delta > 0
  ) {
    reasons.push(delta >= 6 ? "late_game_usage" : "close_game");
  }
  if (input.situationsSeen.includes("blowout_lead") && delta < 0) {
    reasons.push("blowout_rest");
  }

  if (input.entry.minutePriorityBias > 0 && delta > 0) {
    reasons.push("play_more_bias");
  }
  if (input.entry.minutePriorityBias < 0 && delta < 0) {
    reasons.push("play_less_bias");
  }

  if (
    input.actualMinutes >= input.entry.normalMaximumMinutes - 1 &&
    delta > 0
  ) {
    reasons.push("approached_maximum");
  }

  if (
    delta < 0 &&
    input.actualMinutes < input.entry.minimumMinutes &&
    !input.fouledOut &&
    !input.wasInjured
  ) {
    reasons.push("below_minimum_soft");
  }

  if (delta < 0 && reasons.length === 0) {
    reasons.push("bench_performed");
  }

  return reasons.map(reasonLabel);
}
