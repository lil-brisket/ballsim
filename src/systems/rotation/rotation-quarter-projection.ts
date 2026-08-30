/**
 * Project expected on-court presence by quarter from Target MPG + role.
 * This is a projection, not a scripted substitution schedule.
 */

import type { RotationEntry, RotationRole } from "@/domain/entities/team-roster-management";

export type QuarterProjectionPlayer = {
  playerId: string;
  role: RotationRole;
  targetMinutes: number;
  /** Expected minutes in this quarter (approx). */
  quarterMinutes: number;
  /** 0–1 share of the quarter on court. */
  courtShare: number;
};

export type QuarterProjection = {
  quarter: 1 | 2 | 3 | 4;
  players: QuarterProjectionPlayer[];
};

const QUARTER_MINUTES = 12;

/**
 * Stagger model:
 * - Starters heavy Q1/Q3 openers and Q4 close
 * - Sixth man / rotation heavy Q1/Q2/Q3 middle
 * - Bench heavier Q2/Q4 garbage-ish / rest segments
 */
function roleQuarterWeights(role: RotationRole): [number, number, number, number] {
  switch (role) {
    case "starter":
      return [0.28, 0.22, 0.25, 0.25];
    case "sixth_man":
      return [0.2, 0.3, 0.28, 0.22];
    case "rotation":
      return [0.22, 0.28, 0.28, 0.22];
    case "bench":
    case "deep_bench":
      return [0.15, 0.35, 0.25, 0.25];
    case "emergency":
      return [0.1, 0.3, 0.2, 0.4];
  }
}

export function projectRotationByQuarter(
  entries: readonly RotationEntry[],
): QuarterProjection[] {
  const active = entries.filter(
    (e) => e.targetMinutes > 0 && e.rotationStatus !== "inactive",
  );

  const quarters: QuarterProjection[] = [];
  for (let q = 1; q <= 4; q++) {
    const players: QuarterProjectionPlayer[] = [];
    for (const entry of active) {
      const weights = roleQuarterWeights(entry.role);
      const quarterMinutes = Math.round(entry.targetMinutes * weights[q - 1]!);
      if (quarterMinutes <= 0) continue;
      players.push({
        playerId: entry.playerId,
        role: entry.role,
        targetMinutes: entry.targetMinutes,
        quarterMinutes,
        courtShare: Math.min(1, quarterMinutes / QUARTER_MINUTES),
      });
    }
    players.sort((a, b) => b.quarterMinutes - a.quarterMinutes);
    quarters.push({
      quarter: q as 1 | 2 | 3 | 4,
      players,
    });
  }
  return quarters;
}
