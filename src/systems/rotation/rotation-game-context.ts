/**
 * Game-state awareness for rotation decisions.
 */

import type { GameCompetitionType } from "@/domain/entities/game";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";

export type GameSituation =
  | "normal"
  | "close"
  | "blowout_lead"
  | "blowout_deficit"
  | "late_close"
  | "overtime";

export type RotationGameContext = {
  situation: GameSituation;
  periodNumber: number;
  secondsRemainingInPeriod: number;
  elapsedGameSeconds: number;
  scoreDifferential: number; // positive = this team leading
  isPlayoffs: boolean;
  isOvertime: boolean;
  /** Prefer absolute max over normal max when true. */
  useAbsoluteMaximum: boolean;
  closingLineupWeight: number;
  fatigueWeight: number;
  targetMinutesAdjustment: number;
  maximumOverridePolicy: "normal" | "absolute";
};

export function buildRotationGameContext(input: {
  periodNumber: number;
  secondsRemainingInPeriod: number;
  elapsedGameSeconds: number;
  teamScore: number;
  opponentScore: number;
  competitionType: GameCompetitionType;
  regulationPeriodCount?: number;
}): RotationGameContext {
  const regulationPeriods = input.regulationPeriodCount ?? 4;
  const isOvertime = input.periodNumber > regulationPeriods;
  const isPlayoffs = input.competitionType === "playoffs";
  const scoreDifferential = input.teamScore - input.opponentScore;
  const absMargin = Math.abs(scoreDifferential);
  const late =
    (input.periodNumber === regulationPeriods || isOvertime) &&
    input.secondsRemainingInPeriod <=
      ROTATION_CONFIG.lateGameSecondsRemaining;

  const isLateClose =
    late && absMargin <= ROTATION_CONFIG.closeGameMargin && !isOvertime;

  let situation: GameSituation = "normal";
  if (isOvertime) {
    situation = "overtime";
  } else if (isLateClose) {
    situation = "late_close";
  } else if (
    input.periodNumber >= regulationPeriods &&
    absMargin >= ROTATION_CONFIG.blowoutMargin
  ) {
    situation =
      scoreDifferential > 0 ? "blowout_lead" : "blowout_deficit";
  } else if (absMargin <= ROTATION_CONFIG.closeGameMargin) {
    situation = "close";
  }

  const useAbsolute =
    isOvertime ||
    isLateClose ||
    (isPlayoffs &&
      (situation === "close" || isLateClose));

  return {
    situation,
    periodNumber: input.periodNumber,
    secondsRemainingInPeriod: input.secondsRemainingInPeriod,
    elapsedGameSeconds: input.elapsedGameSeconds,
    scoreDifferential,
    isPlayoffs,
    isOvertime,
    useAbsoluteMaximum: useAbsolute,
    closingLineupWeight:
      situation === "late_close" || situation === "overtime"
        ? 2.5
        : situation === "close"
          ? 1.5
          : 1,
    fatigueWeight: isOvertime ? 1.35 : 1,
    targetMinutesAdjustment: isOvertime
      ? ROTATION_CONFIG.overtimePeriodMinutes
      : 0,
    maximumOverridePolicy: useAbsolute ? "absolute" : "normal",
  };
}

export function isInRotationWindow(
  secondsRemainingInPeriod: number,
): boolean {
  return ROTATION_CONFIG.quarterWindows.some(
    (window) =>
      secondsRemainingInPeriod <= window.clockRangeStart &&
      secondsRemainingInPeriod >= window.clockRangeEnd,
  );
}
