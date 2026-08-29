/**
 * Validates secondsOnCourt totals at the simulation layer.
 * Never rewrites minutes — reports failures only.
 */

import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";

export type MinuteAccountingFailure = {
  rule: string;
  detail: string;
};

/**
 * Expected team player-seconds for a completed game.
 * Regulation: 5 × 48 × 60 = 14400
 * Each OT period: + 5 × 5 × 60 = 1500
 */
export function expectedTeamPlayerSeconds(
  overtimePeriods: number,
): number {
  const regulation =
    ROTATION_CONFIG.playersOnCourt *
    ROTATION_CONFIG.regulationMinutes *
    60;
  const ot =
    overtimePeriods *
    ROTATION_CONFIG.playersOnCourt *
    ROTATION_CONFIG.overtimePeriodMinutes *
    60;
  return regulation + ot;
}

export function validateTeamSecondsOnCourt(input: {
  teamLabel: string;
  secondsByPlayerId: ReadonlyMap<string, number>;
  teamPlayerIds: readonly string[];
  overtimePeriods: number;
  /** Allow small float drift from clock consumption. */
  toleranceSeconds?: number;
}): MinuteAccountingFailure[] {
  const tolerance = input.toleranceSeconds ?? 2;
  const expected = expectedTeamPlayerSeconds(input.overtimePeriods);
  let sum = 0;
  for (const playerId of input.teamPlayerIds) {
    const seconds = input.secondsByPlayerId.get(playerId) ?? 0;
    if (seconds < -0.01) {
      return [
        {
          rule: "NEGATIVE_SECONDS",
          detail: `${input.teamLabel} player ${playerId} has negative secondsOnCourt (${seconds})`,
        },
      ];
    }
    sum += seconds;
  }

  const delta = Math.abs(sum - expected);
  if (delta > tolerance) {
    return [
      {
        rule: "TEAM_SECONDS_MISMATCH",
        detail: `${input.teamLabel} sum(secondsOnCourt)=${sum.toFixed(1)} expected=${expected} (OT=${input.overtimePeriods}, Δ=${delta.toFixed(1)})`,
      },
    ];
  }
  return [];
}

export function assertTeamSecondsOnCourt(
  input: Parameters<typeof validateTeamSecondsOnCourt>[0],
): void {
  const failures = validateTeamSecondsOnCourt(input);
  if (failures.length === 0) {
    return;
  }
  throw new Error(
    failures.map((f) => `${f.rule}: ${f.detail}`).join("; "),
  );
}
