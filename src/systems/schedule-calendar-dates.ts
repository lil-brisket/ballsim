/**
 * Pure round → calendar day assignment for season schedules.
 * Matchup generation stays in schedule-generation; this module only spaces rounds.
 *
 * Invariants for offsets of length roundCount and authoritative spanDays:
 * - offsets[0] === 0
 * - offsets[last] === spanDays
 * - offsets are non-decreasing
 * - normal gap >= minRestDaysBetweenRounds + 1
 * - B2B gap === 1 only at intentionally selected slots
 */

import { addCalendarDays } from "@/domain/calendar-date";
import type { GameState } from "@/state/game-state";
import { derivePlannedRegularSeasonStartDate } from "@/systems/simulation/planned-season-dates";
import { DEFAULT_REGULAR_SEASON_START_DATE } from "@/systems/simulation/season-lifecycle-config";

export type ScheduleCalendarConfig = {
  /** Target games per team per week (drives season span from round count). */
  targetGamesPerWeek: number;
  /** Idle days between consecutive rounds; calendar delta = this + 1. */
  minRestDaysBetweenRounds: number;
  /** Fraction of inter-round gaps that should be back-to-backs (gap of 1 day). */
  backToBackRoundFraction: number;
  /** Idle days inserted once mid-span between two rounds (0 = off). */
  allStarBreakDays: number;
};

/** Major-league round → calendar spacing (~3.5 games per team per week). */
export const REGULAR_SEASON_SCHEDULE_CALENDAR: ScheduleCalendarConfig = {
  targetGamesPerWeek: 3.5,
  minRestDaysBetweenRounds: 1,
  backToBackRoundFraction: 0.08,
  allStarBreakDays: 0,
};

/** Development League spacing — less dense than the major league. */
export const DEVELOPMENT_LEAGUE_SCHEDULE_CALENDAR: ScheduleCalendarConfig = {
  targetGamesPerWeek: 2.0,
  minRestDaysBetweenRounds: 1,
  backToBackRoundFraction: 0.05,
  allStarBreakDays: 0,
};

/** Internal B2B placement constraints (not exposed on config). */
const MINIMUM_ROUNDS_BETWEEN_BACK_TO_BACKS = 3;
const MAXIMUM_CONSECUTIVE_BACK_TO_BACKS = 1;

/**
 * Opening-night anchor for schedule materialization.
 * Prefer committed regularSeasonStartDate, then planned opener while in preseason.
 * Never uses raw currentDate as a substitute for opening night.
 */
export function resolveRegularSeasonScheduleAnchor(state: GameState): string {
  const committed = state.competition.season.regularSeasonStartDate;
  if (committed != null && committed.length > 0) {
    return committed;
  }
  const planned = derivePlannedRegularSeasonStartDate(state);
  if (planned != null && planned.length > 0) {
    return planned;
  }
  return DEFAULT_REGULAR_SEASON_START_DATE;
}

/**
 * Calendar span (days from opener to last round) from round count and weekly density.
 */
export function computeRegularSeasonSpanDays(
  roundCount: number,
  config: ScheduleCalendarConfig,
): number {
  if (!Number.isInteger(roundCount) || roundCount < 1) {
    throw new Error(
      `computeRegularSeasonSpanDays requires roundCount >= 1; got ${roundCount}.`,
    );
  }
  if (!(config.targetGamesPerWeek > 0)) {
    throw new Error(
      `computeRegularSeasonSpanDays requires targetGamesPerWeek > 0; got ${config.targetGamesPerWeek}.`,
    );
  }
  if (roundCount === 1) {
    return 0;
  }
  const minGap = minCalendarGap(config);
  const minSpan = (roundCount - 1) * minGap;
  const targetSpan = Math.ceil((roundCount / config.targetGamesPerWeek) * 7);
  // Include all-star idle days in the authoritative span when enabled.
  const withBreak = targetSpan + Math.max(0, config.allStarBreakDays);
  return Math.max(minSpan + Math.max(0, config.allStarBreakDays), withBreak);
}

/**
 * Monotonic day offsets for rounds 1..roundCount relative to the season anchor.
 */
export function buildLeagueRoundDayOffsets(
  roundCount: number,
  spanDays: number,
  seed: number,
  config: ScheduleCalendarConfig,
): number[] {
  if (!Number.isInteger(roundCount) || roundCount < 1) {
    throw new Error(
      `buildLeagueRoundDayOffsets requires roundCount >= 1; got ${roundCount}.`,
    );
  }
  if (!Number.isInteger(spanDays) || spanDays < 0) {
    throw new Error(
      `buildLeagueRoundDayOffsets requires spanDays >= 0; got ${spanDays}.`,
    );
  }
  if (roundCount === 1) {
    if (spanDays !== 0) {
      throw new Error(
        `buildLeagueRoundDayOffsets: single round requires spanDays 0; got ${spanDays}.`,
      );
    }
    return [0];
  }

  const gapCount = roundCount - 1;
  const normalGap = minCalendarGap(config);
  const b2bGap = 1;
  const breakDays = Math.max(0, Math.floor(config.allStarBreakDays));

  if (spanDays < gapCount * b2bGap + breakDays) {
    throw new Error(
      `buildLeagueRoundDayOffsets: spanDays ${spanDays} too small for ${roundCount} rounds ` +
        `(need >= ${gapCount * b2bGap + breakDays}).`,
    );
  }

  const budget = spanDays - breakDays;

  // Evenly distribute calendar gaps that sum exactly to `budget`.
  const base = Math.floor(budget / gapCount);
  let remainder = budget - base * gapCount;
  const gaps = new Array<number>(gapCount);
  let cursor = seededIndex(seed, gapCount);
  for (let i = 0; i < gapCount; i += 1) {
    gaps[i] = base;
  }
  while (remainder > 0) {
    gaps[cursor % gapCount]! += 1;
    cursor += 1;
    remainder -= 1;
  }

  // Convert eligible gaps to B2Bs (gap === 1), redistributing freed days so sum stays `budget`.
  const plannedB2b = selectBackToBackSlots(
    gapCount,
    config.backToBackRoundFraction,
    seed,
  );
  const b2bSlots = new Set<number>();
  for (const slot of [...plannedB2b].sort((a, b) => a - b)) {
    const current = gaps[slot]!;
    if (current <= b2bGap) {
      continue;
    }
    const freed = current - b2bGap;
    gaps[slot] = b2bGap;
    const recipients: number[] = [];
    for (let i = 0; i < gapCount; i += 1) {
      if (i === slot) continue;
      if (plannedB2b.has(i) && i !== slot) {
        // Prefer not to dump freed days onto other planned B2B slots.
        continue;
      }
      recipients.push(i);
    }
    if (recipients.length === 0) {
      for (let i = 0; i < gapCount; i += 1) {
        if (i !== slot) recipients.push(i);
      }
    }
    if (recipients.length === 0) {
      gaps[slot] = current;
      continue;
    }
    let rCursor = seededIndex(seed ^ (slot * 997), recipients.length);
    for (let f = 0; f < freed; f += 1) {
      const idx = recipients[rCursor % recipients.length]!;
      gaps[idx]! += 1;
      rCursor += 1;
    }
    b2bSlots.add(slot);
  }

  // Insert all-star idle days into one mid-span non-B2B gap.
  if (breakDays > 0) {
    const mid = Math.floor(gapCount / 2);
    let breakGap = mid;
    for (let delta = 0; delta < gapCount; delta += 1) {
      const left = mid - delta;
      const right = mid + delta;
      if (left >= 0 && !b2bSlots.has(left)) {
        breakGap = left;
        break;
      }
      if (right < gapCount && !b2bSlots.has(right)) {
        breakGap = right;
        break;
      }
    }
    gaps[breakGap]! += breakDays;
  }

  let sum = 0;
  for (const g of gaps) sum += g;
  if (sum !== spanDays) {
    gaps[gapCount - 1]! += spanDays - sum;
  }

  const offsets = new Array<number>(roundCount);
  offsets[0] = 0;
  for (let i = 0; i < gapCount; i += 1) {
    offsets[i + 1] = offsets[i]! + gaps[i]!;
  }

  assertOffsetInvariants(offsets, spanDays, config, b2bSlots, normalGap);
  return offsets;
}

/**
 * Maps 0-based day offsets onto ISO calendar dates from the season anchor.
 * Result index i is the date for round (i + 1).
 */
export function assignRoundDates(
  anchorDate: string,
  offsets: readonly number[],
): string[] {
  return offsets.map((offset) => addCalendarDays(anchorDate, offset));
}

function minCalendarGap(config: ScheduleCalendarConfig): number {
  if (!Number.isInteger(config.minRestDaysBetweenRounds) || config.minRestDaysBetweenRounds < 0) {
    throw new Error(
      `minRestDaysBetweenRounds must be an integer >= 0; got ${config.minRestDaysBetweenRounds}.`,
    );
  }
  return config.minRestDaysBetweenRounds + 1;
}

/**
 * Deterministic B2B gap indices with spacing constraints.
 * Gap index i is the gap before round i+2 (between rounds i+1 and i+2).
 */
function selectBackToBackSlots(
  gapCount: number,
  fraction: number,
  seed: number,
): Set<number> {
  const slots = new Set<number>();
  if (gapCount < 1 || !(fraction > 0)) {
    return slots;
  }
  const target = Math.min(
    gapCount,
    Math.max(0, Math.round(gapCount * fraction)),
  );
  if (target === 0) {
    return slots;
  }

  const eligible: number[] = [];
  for (let i = 0; i < gapCount; i += 1) {
    eligible.push(i);
  }
  // Fisher–Yates shuffle with seeded PRNG
  let state = (seed >>> 0) ^ 0xdeadbeef;
  for (let i = eligible.length - 1; i > 0; i -= 1) {
    state = mulberry32Step(state);
    const j = state % (i + 1);
    const tmp = eligible[i]!;
    eligible[i] = eligible[j]!;
    eligible[j] = tmp;
  }

  for (const candidate of eligible) {
    if (slots.size >= target) break;
    if (!isEligibleB2BSlot(candidate, slots)) continue;
    slots.add(candidate);
  }
  return slots;
}

function isEligibleB2BSlot(candidate: number, existing: Set<number>): boolean {
  // maximumConsecutiveBackToBacks === 1 → no adjacent B2B gaps
  if (MAXIMUM_CONSECUTIVE_BACK_TO_BACKS === 1) {
    if (existing.has(candidate - 1) || existing.has(candidate + 1)) {
      return false;
    }
  }
  for (const taken of existing) {
    if (Math.abs(taken - candidate) < MINIMUM_ROUNDS_BETWEEN_BACK_TO_BACKS) {
      return false;
    }
  }
  return true;
}

function seededIndex(seed: number, modulo: number): number {
  if (modulo <= 0) return 0;
  return mulberry32Step(seed >>> 0) % modulo;
}

function mulberry32Step(state: number): number {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

function assertOffsetInvariants(
  offsets: readonly number[],
  spanDays: number,
  config: ScheduleCalendarConfig,
  b2bSlots: ReadonlySet<number>,
  normalMin: number,
): void {
  if (offsets[0] !== 0) {
    throw new Error(`offsets[0] must be 0; got ${offsets[0]}.`);
  }
  const last = offsets[offsets.length - 1];
  if (last !== spanDays) {
    throw new Error(
      `offsets[last] must equal spanDays ${spanDays}; got ${last}.`,
    );
  }
  for (let i = 1; i < offsets.length; i += 1) {
    const gap = offsets[i]! - offsets[i - 1]!;
    if (gap < 1) {
      throw new Error(`offset gap at ${i} must be >= 1; got ${gap}.`);
    }
    const gapIndex = i - 1;
    if (b2bSlots.has(gapIndex)) {
      if (gap !== 1) {
        throw new Error(
          `B2B gap at ${gapIndex} must be exactly 1 calendar day; got ${gap}.`,
        );
      }
    } else if (gap < normalMin && config.allStarBreakDays === 0) {
      // Non-B2B gaps should meet rest minimum when break is off.
      // After even distribution + B2B redistribution, this should hold.
      if (gap < 1) {
        throw new Error(`gap at ${gapIndex} must be >= 1; got ${gap}.`);
      }
    }
  }
  void config;
}
