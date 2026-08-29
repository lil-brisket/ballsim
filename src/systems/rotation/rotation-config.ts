/**
 * Tunable constants for the rotation / substitution engine.
 */

export const ROTATION_CONFIG = {
  personalFoulLimit: 6,
  /** Soft foul-trouble tiers by period (fouls at or above → reduced priority). */
  foulTroubleTiers: {
    period1: 2,
    period2: 3,
    period3Early: 4,
    period4: 5,
  },
  /** Max discretionary substitutions per checkpoint per team. */
  tacticalSubsPerCheckpoint: 2,
  /** Minimum continuous court seconds before a tactical sub-out. */
  minContinuousSecondsBeforeTacticalSub: 90,
  /** Fatigue [0,1] above which substitution priority increases. */
  fatigueSubThreshold: 0.65,
  /** Continuous stretch (seconds) that elevates fatigue-driven sub consideration. */
  continuousStretchSeconds: 360,
  /** Score margin treated as a blowout in Q4. */
  blowoutMargin: 20,
  /** Score margin treated as a close game in late Q4. */
  closeGameMargin: 8,
  /** Late-game clock threshold (seconds remaining in Q4 / OT). */
  lateGameSecondsRemaining: 360,
  /** Quarter clock windows (seconds remaining) for rotation opportunities. */
  quarterWindows: [
    { clockRangeStart: 420, clockRangeEnd: 300 }, // 7:00–5:00
    { clockRangeStart: 240, clockRangeEnd: 120 }, // 4:00–2:00
  ] as const,
  regulationPlayerMinutes: 240,
  playersOnCourt: 5,
  regulationMinutes: 48,
  overtimePeriodMinutes: 5,
} as const;

export type RotationConfig = typeof ROTATION_CONFIG;
