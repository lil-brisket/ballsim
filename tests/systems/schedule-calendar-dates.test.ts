import { describe, expect, it } from "vitest";
import { addCalendarDays, calendarDaysBetween } from "@/domain/calendar-date";
import {
  assignRoundDates,
  buildLeagueRoundDayOffsets,
  computeRegularSeasonSpanDays,
  REGULAR_SEASON_SCHEDULE_CALENDAR,
  type ScheduleCalendarConfig,
} from "@/systems/schedule-calendar-dates";

const baseConfig: ScheduleCalendarConfig = {
  ...REGULAR_SEASON_SCHEDULE_CALENDAR,
};

describe("schedule-calendar-dates", () => {
  it("computes span from roundCount and targetGamesPerWeek", () => {
    const span = computeRegularSeasonSpanDays(82, baseConfig);
    // ceil(82 / 3.5 * 7) = 164
    expect(span).toBe(164);
  });

  it("uses roundCount (not gamesPerTeam) so odd leagues stay consistent", () => {
    // 21 teams / 84 games → expectedRoundCount = 88
    const span88 = computeRegularSeasonSpanDays(88, baseConfig);
    const span84 = computeRegularSeasonSpanDays(84, baseConfig);
    expect(span88).toBeGreaterThan(span84);
  });

  it("offsets satisfy fixed-span invariants", () => {
    const roundCount = 82;
    const spanDays = computeRegularSeasonSpanDays(roundCount, baseConfig);
    const offsets = buildLeagueRoundDayOffsets(
      roundCount,
      spanDays,
      42,
      baseConfig,
    );
    expect(offsets).toHaveLength(roundCount);
    expect(offsets[0]).toBe(0);
    expect(offsets[roundCount - 1]).toBe(spanDays);
    for (let i = 1; i < offsets.length; i += 1) {
      expect(offsets[i]!).toBeGreaterThanOrEqual(offsets[i - 1]!);
      expect(offsets[i]! - offsets[i - 1]!).toBeGreaterThanOrEqual(1);
    }
  });

  it("B2Bs are isolated (no adjacent B2B gaps, spacing constraint)", () => {
    const roundCount = 82;
    const spanDays = computeRegularSeasonSpanDays(roundCount, baseConfig);
    const offsets = buildLeagueRoundDayOffsets(
      roundCount,
      spanDays,
      99,
      baseConfig,
    );
    const b2bGapIndexes: number[] = [];
    for (let i = 1; i < offsets.length; i += 1) {
      if (offsets[i]! - offsets[i - 1]! === 1) {
        b2bGapIndexes.push(i - 1);
      }
    }
    expect(b2bGapIndexes.length).toBeGreaterThan(0);
    for (let i = 1; i < b2bGapIndexes.length; i += 1) {
      expect(b2bGapIndexes[i]! - b2bGapIndexes[i - 1]!).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  it("preserves span when allStarBreakDays > 0", () => {
    const config: ScheduleCalendarConfig = {
      ...baseConfig,
      allStarBreakDays: 3,
    };
    const roundCount = 40;
    const spanDays = computeRegularSeasonSpanDays(roundCount, config);
    const offsets = buildLeagueRoundDayOffsets(roundCount, spanDays, 7, config);
    expect(offsets[0]).toBe(0);
    expect(offsets[roundCount - 1]).toBe(spanDays);
    // At least one gap larger than typical (break inserted).
    let maxGap = 0;
    for (let i = 1; i < offsets.length; i += 1) {
      maxGap = Math.max(maxGap, offsets[i]! - offsets[i - 1]!);
    }
    expect(maxGap).toBeGreaterThanOrEqual(3 + 1);
  });

  it("assignRoundDates maps offsets onto the anchor", () => {
    const anchor = "2026-10-01";
    const dates = assignRoundDates(anchor, [0, 2, 5]);
    expect(dates).toEqual([
      "2026-10-01",
      addCalendarDays(anchor, 2),
      addCalendarDays(anchor, 5),
    ]);
    expect(calendarDaysBetween(dates[0]!, dates[2]!)).toBe(5);
  });

  it("is deterministic for the same seed", () => {
    const roundCount = 22;
    const spanDays = computeRegularSeasonSpanDays(roundCount, baseConfig);
    const a = buildLeagueRoundDayOffsets(roundCount, spanDays, 123, baseConfig);
    const b = buildLeagueRoundDayOffsets(roundCount, spanDays, 123, baseConfig);
    expect(a).toEqual(b);
  });
});
