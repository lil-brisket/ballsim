/**
 * Pre-game feasibility: min/max sums vs available player-minutes.
 */

import type { TeamRosterManagement } from "@/domain/entities/team-roster-management";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";

export type RotationFeasibilityIssue = {
  code:
    | "minimums_exceed_available"
    | "maximums_below_available"
    | "insufficient_active"
    | "targets_unbalanced"
    | "all_targets_zero";
  message: string;
};

export type RotationFeasibilityResult = {
  feasible: boolean;
  availablePlayerMinutes: number;
  sumMinimum: number;
  sumAbsoluteMaximum: number;
  sumTarget: number;
  activeCount: number;
  issues: RotationFeasibilityIssue[];
};

export function availablePlayerMinutesForGame(
  overtimePeriods: number = 0,
): number {
  return (
    ROTATION_CONFIG.regulationPlayerMinutes +
    overtimePeriods *
      ROTATION_CONFIG.playersOnCourt *
      ROTATION_CONFIG.overtimePeriodMinutes
  );
}

/**
 * Validates that rotation settings can produce a legal minute distribution.
 * Uses absoluteMaximum for the hard ceiling check.
 */
export function validateRotationFeasibility(
  management: TeamRosterManagement,
  overtimePeriods: number = 0,
): RotationFeasibilityResult {
  const available = availablePlayerMinutesForGame(overtimePeriods);
  const issues: RotationFeasibilityIssue[] = [];

  const pool = management.rotation.filter(
    (entry) =>
      entry.rotationStatus === "active" ||
      entry.rotationStatus === "emergency",
  );
  // Feasibility for max/min uses active (and emergency only if needed — use active first)
  const active = management.rotation.filter(
    (entry) => entry.rotationStatus === "active",
  );

  const sumMinimum = active.reduce(
    (sum, entry) => sum + entry.minimumMinutes,
    0,
  );
  const sumAbsoluteMaximum = active.reduce(
    (sum, entry) => sum + entry.absoluteMaximumMinutes,
    0,
  );
  const sumTarget = active.reduce((sum, entry) => sum + entry.targetMinutes, 0);

  if (active.length < ROTATION_CONFIG.playersOnCourt) {
    issues.push({
      code: "insufficient_active",
      message: `Need at least ${ROTATION_CONFIG.playersOnCourt} active rotation players (have ${active.length}).`,
    });
  }

  if (sumTarget === 0 && active.length > 0) {
    issues.push({
      code: "all_targets_zero",
      message:
        "All active players have 0 target minutes. Use Auto Optimize or assign targets.",
    });
  }

  if (sumMinimum > available) {
    issues.push({
      code: "minimums_exceed_available",
      message: `Minimum minutes (${sumMinimum}) exceed available team minutes (${available}).`,
    });
  }

  if (active.length >= ROTATION_CONFIG.playersOnCourt && sumAbsoluteMaximum < available) {
    issues.push({
      code: "maximums_below_available",
      message: `Maximum minutes currently allow only ${sumAbsoluteMaximum} team minutes (need ${available}). Increase player maximums or use Auto Optimize.`,
    });
  }

  const targetDelta = Math.abs(sumTarget - available);
  if (sumTarget > 0 && targetDelta > 30) {
    issues.push({
      code: "targets_unbalanced",
      message: `Target minutes (${sumTarget}) are far from available (${available}).`,
    });
  }

  return {
    feasible: issues.every(
      (issue) =>
        issue.code === "targets_unbalanced", // soft warning only
    ),
    availablePlayerMinutes: available,
    sumMinimum,
    sumAbsoluteMaximum,
    sumTarget,
    activeCount: active.length,
    issues,
  };
}

/** Hard blockers that should warn prominently / allow AI auto-fix. */
export function hasHardFeasibilityIssues(
  result: RotationFeasibilityResult,
): boolean {
  return result.issues.some(
    (issue) =>
      issue.code === "minimums_exceed_available" ||
      issue.code === "maximums_below_available" ||
      issue.code === "insufficient_active" ||
      issue.code === "all_targets_zero",
  );
}

export function formatFeasibilityBanner(
  result: RotationFeasibilityResult,
): string | null {
  const hard = result.issues.find(
    (issue) =>
      issue.code === "maximums_below_available" ||
      issue.code === "minimums_exceed_available" ||
      issue.code === "all_targets_zero" ||
      issue.code === "insufficient_active",
  );
  if (hard == null) {
    return null;
  }
  return `Rotation settings need attention: ${hard.message}`;
}
