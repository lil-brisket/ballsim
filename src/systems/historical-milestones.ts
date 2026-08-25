/**
 * Historical milestone queries over FranchiseHistory (facts) + live pace metrics.
 * Distinguishes achieved / approaching / projected.
 */

import {
  isPlayoffAppearance,
  type FranchiseSeasonRecord,
} from "@/domain/entities/franchise-history";
import type {
  MilestoneKind,
  MilestoneResult,
  MilestoneStatus,
} from "@/domain/entities/historical-milestone";

export type LiveMilestoneContext = {
  /** Current (possibly incomplete) season year. */
  seasonYear: number;
  wins: number;
  losses: number;
  /** Projected end-of-season wins if pace continues; null if unavailable. */
  projectedWins: number | null;
  attendanceToDate: number | null;
  /** Projected season attendance; null if unavailable. */
  projectedAttendance: number | null;
  franchiseValue: number;
  netIncome: number | null;
  playoffClinched: boolean;
  championshipWon: boolean;
  /** True if franchise relocated in a prior completed season. */
  hasRelocatedBefore: boolean;
  /** Seasons since last relocation (0 if never). */
  seasonsSinceRelocation: number | null;
};

function maxWins(seasons: readonly FranchiseSeasonRecord[]): number {
  let best = 0;
  for (const s of seasons) {
    if (s.wins > best) best = s.wins;
  }
  return best;
}

function maxAttendance(seasons: readonly FranchiseSeasonRecord[]): number | null {
  let best: number | null = null;
  for (const s of seasons) {
    if (s.attendance === null) continue;
    if (best === null || s.attendance > best) best = s.attendance;
  }
  return best;
}

function maxValue(seasons: readonly FranchiseSeasonRecord[]): number {
  let best = 0;
  for (const s of seasons) {
    if (s.franchiseValue > best) best = s.franchiseValue;
  }
  return best;
}

function currentPlayoffStreak(seasons: readonly FranchiseSeasonRecord[]): number {
  let streak = 0;
  for (let i = seasons.length - 1; i >= 0; i -= 1) {
    if (!isPlayoffAppearance(seasons[i]!.playoffResult)) break;
    streak += 1;
  }
  return streak;
}

function push(
  out: MilestoneResult[],
  kind: MilestoneKind,
  status: MilestoneStatus,
  message: string,
  currentValue: number,
  thresholdValue: number | null,
  seasonYear: number | null,
): void {
  out.push({
    kind,
    status,
    message,
    currentValue,
    thresholdValue,
    margin:
      thresholdValue === null ? 0 : Math.abs(thresholdValue - currentValue),
    seasonYear,
  });
}

/**
 * Evaluate historical milestones for completed seasons + optional live pace.
 */
export function queryHistoricalMilestones(
  seasons: readonly FranchiseSeasonRecord[],
  live?: LiveMilestoneContext | null,
): MilestoneResult[] {
  const results: MilestoneResult[] = [];
  const ordered = [...seasons].sort((a, b) => a.seasonYear - b.seasonYear);

  const championships = ordered.filter((s) => s.championship);
  const playoffs = ordered.filter((s) => isPlayoffAppearance(s.playoffResult));
  const fiftyWins = ordered.filter((s) => s.wins >= 50);
  const positiveIncome = ordered.filter((s) => s.netIncome > 0);
  const twoB = ordered.filter((s) => s.franchiseValue >= 2_000_000_000);

  // Firsts from completed history
  if (championships.length > 0) {
    const first = championships[0]!;
    push(
      results,
      "first_championship",
      "achieved",
      `First championship (${first.seasonYear}).`,
      1,
      1,
      first.seasonYear,
    );
  }
  if (playoffs.length > 0) {
    const first = playoffs[0]!;
    push(
      results,
      "first_playoff",
      "achieved",
      `First playoff appearance (${first.seasonYear}).`,
      1,
      1,
      first.seasonYear,
    );
  }
  if (fiftyWins.length > 0) {
    const first = fiftyWins[0]!;
    push(
      results,
      "first_50_win_season",
      "achieved",
      `First 50-win season (${first.seasonYear}).`,
      first.wins,
      50,
      first.seasonYear,
    );
  }
  if (positiveIncome.length > 0) {
    const first = positiveIncome[0]!;
    push(
      results,
      "first_positive_operating_income",
      "achieved",
      `First season with positive operating income (${first.seasonYear}).`,
      first.netIncome,
      0,
      first.seasonYear,
    );
  }
  if (twoB.length > 0) {
    const first = twoB[0]!;
    push(
      results,
      "first_2b_valuation",
      "achieved",
      `First $2B franchise valuation (${first.seasonYear}).`,
      first.franchiseValue,
      2_000_000_000,
      first.seasonYear,
    );
  }

  // Three-year playoff streak first occurrence
  let streak = 0;
  let firstThreeYear: number | null = null;
  for (const s of ordered) {
    if (isPlayoffAppearance(s.playoffResult)) {
      streak += 1;
      if (streak >= 3 && firstThreeYear === null) {
        firstThreeYear = s.seasonYear;
      }
    } else {
      streak = 0;
    }
  }
  if (firstThreeYear !== null) {
    push(
      results,
      "first_three_year_playoff_streak",
      "achieved",
      `First three-season playoff streak completed in ${firstThreeYear}.`,
      3,
      3,
      firstThreeYear,
    );
  }

  // Back-to-back championships
  for (let i = 1; i < ordered.length; i += 1) {
    if (ordered[i]!.championship && ordered[i - 1]!.championship) {
      push(
        results,
        "first_back_to_back_championship",
        "achieved",
        `Back-to-back championships culminating in ${ordered[i]!.seasonYear}.`,
        2,
        2,
        ordered[i]!.seasonYear,
      );
      break;
    }
  }

  // Relocation-relative firsts
  const relocationYears = ordered.filter((s) => s.relocated).map((s) => s.seasonYear);
  if (relocationYears.length > 0) {
    const relocateYear = relocationYears[0]!;
    const after = ordered.filter((s) => s.seasonYear > relocateYear);
    const firstPlayoffAfter = after.find((s) => isPlayoffAppearance(s.playoffResult));
    const firstTitleAfter = after.find((s) => s.championship);
    if (firstPlayoffAfter) {
      push(
        results,
        "first_playoff_after_relocation",
        "achieved",
        `First playoff appearance after relocating (${firstPlayoffAfter.seasonYear}).`,
        1,
        1,
        firstPlayoffAfter.seasonYear,
      );
    }
    if (firstTitleAfter) {
      push(
        results,
        "first_championship_after_relocation",
        "achieved",
        `First championship after relocating (${firstTitleAfter.seasonYear}).`,
        1,
        1,
        firstTitleAfter.seasonYear,
      );
    }
  }

  // Franchise records (completed) — only when not evaluating live pace
  // (live path emits approaching/projected/achieved for the current season).
  if (ordered.length > 0 && !live) {
    const bestWins = [...ordered].sort((a, b) => b.wins - a.wins)[0]!;
    push(
      results,
      "franchise_record_wins",
      "achieved",
      `Franchise record for wins: ${bestWins.wins} (${bestWins.seasonYear}).`,
      bestWins.wins,
      bestWins.wins,
      bestWins.seasonYear,
    );
    const bestAtt = [...ordered]
      .filter((s) => s.attendance !== null)
      .sort((a, b) => (b.attendance ?? 0) - (a.attendance ?? 0))[0];
    if (bestAtt?.attendance != null) {
      push(
        results,
        "franchise_record_attendance",
        "achieved",
        `Franchise attendance record: ${bestAtt.attendance.toLocaleString()} (${bestAtt.seasonYear}).`,
        bestAtt.attendance,
        bestAtt.attendance,
        bestAtt.seasonYear,
      );
    }
    const bestVal = [...ordered].sort((a, b) => b.franchiseValue - a.franchiseValue)[0]!;
    push(
      results,
      "franchise_record_franchise_value",
      "achieved",
      `Franchise value record: $${Math.round(bestVal.franchiseValue / 1e6)}M (${bestVal.seasonYear}).`,
      bestVal.franchiseValue,
      bestVal.franchiseValue,
      bestVal.seasonYear,
    );
  }

  // Live / in-season projections
  if (live) {
    const recordWins = maxWins(ordered);
    if (live.wins > recordWins) {
      push(
        results,
        "franchise_record_wins",
        "achieved",
        `New franchise wins record: ${live.wins} wins.`,
        live.wins,
        recordWins,
        live.seasonYear,
      );
    } else if (live.wins === recordWins && recordWins > 0) {
      push(
        results,
        "franchise_record_wins",
        "approaching",
        `Tied franchise wins record (${recordWins}). One more win sets a new mark.`,
        live.wins,
        recordWins + 1,
        live.seasonYear,
      );
    } else if (
      live.projectedWins !== null &&
      live.projectedWins > recordWins &&
      live.wins < recordWins
    ) {
      push(
        results,
        "franchise_record_wins",
        "projected",
        `On pace for ${live.projectedWins} wins — would set a franchise record (current record ${recordWins}).`,
        live.projectedWins,
        recordWins,
        live.seasonYear,
      );
    } else if (recordWins - live.wins === 1) {
      push(
        results,
        "franchise_record_wins",
        "approaching",
        `One more win would set a new franchise record for regular-season victories (${recordWins + 1}).`,
        live.wins,
        recordWins + 1,
        live.seasonYear,
      );
    }

    const attRecord = maxAttendance(ordered);
    if (
      live.attendanceToDate !== null &&
      attRecord !== null &&
      live.attendanceToDate > attRecord
    ) {
      push(
        results,
        "franchise_record_attendance",
        "achieved",
        `Franchise attendance record broken this season.`,
        live.attendanceToDate,
        attRecord,
        live.seasonYear,
      );
    } else if (
      live.projectedAttendance !== null &&
      attRecord !== null &&
      live.projectedAttendance > attRecord
    ) {
      push(
        results,
        "franchise_record_attendance",
        "projected",
        `Attendance is on pace to become the highest in franchise history.`,
        live.projectedAttendance,
        attRecord,
        live.seasonYear,
      );
    }

    const valueRecord = maxValue(ordered);
    if (live.franchiseValue > valueRecord && valueRecord > 0) {
      push(
        results,
        "franchise_record_franchise_value",
        "achieved",
        `Franchise value is at an all-time high.`,
        live.franchiseValue,
        valueRecord,
        live.seasonYear,
      );
    } else if (
      valueRecord > 0 &&
      live.franchiseValue >= valueRecord * 0.97 &&
      live.franchiseValue < valueRecord
    ) {
      push(
        results,
        "franchise_record_franchise_value",
        "approaching",
        `Franchise value is approaching the organization's all-time high.`,
        live.franchiseValue,
        valueRecord,
        live.seasonYear,
      );
    }

    if (live.franchiseValue >= 2_000_000_000 && twoB.length === 0) {
      push(
        results,
        "first_2b_valuation",
        "achieved",
        `Franchise valuation has reached $2B for the first time.`,
        live.franchiseValue,
        2_000_000_000,
        live.seasonYear,
      );
    }

    if (
      live.netIncome !== null &&
      live.netIncome > 0 &&
      positiveIncome.length === 0
    ) {
      push(
        results,
        "first_positive_operating_income",
        "projected",
        `On track for the franchise's first season with positive operating income.`,
        live.netIncome,
        0,
        live.seasonYear,
      );
    }

    const histStreak = currentPlayoffStreak(ordered);
    if (live.playoffClinched) {
      const nextStreak = histStreak + 1;
      if (nextStreak === 3 && firstThreeYear === null) {
        push(
          results,
          "first_three_year_playoff_streak",
          "approaching",
          `This would be the franchise's first three-season playoff streak.`,
          nextStreak,
          3,
          live.seasonYear,
        );
      } else if (nextStreak >= 2) {
        push(
          results,
          "playoff_streak",
          "achieved",
          `Extending a ${nextStreak}-season playoff streak.`,
          nextStreak,
          nextStreak,
          live.seasonYear,
        );
      }
    }

    if (live.championshipWon) {
      const last = ordered[ordered.length - 1];
      if (last?.championship) {
        push(
          results,
          "repeat_championship",
          "achieved",
          `A championship this season creates a repeat-champion stretch.`,
          2,
          2,
          live.seasonYear,
        );
      } else if (championships.length === 0) {
        push(
          results,
          "first_championship",
          "achieved",
          `The franchise has won its first championship.`,
          1,
          1,
          live.seasonYear,
        );
      }
    }

    if (
      live.hasRelocatedBefore &&
      live.playoffClinched &&
      !ordered.some(
        (s) =>
          isPlayoffAppearance(s.playoffResult) &&
          relocationYears.length > 0 &&
          s.seasonYear > relocationYears[0]!,
      )
    ) {
      push(
        results,
        "first_playoff_after_relocation",
        "approaching",
        `This would be the franchise's first playoff appearance since relocating.`,
        1,
        1,
        live.seasonYear,
      );
    }

    void live.seasonsSinceRelocation;
  }

  // Deduplicate by kind+status preferring achieved > approaching > projected
  const rank: Record<MilestoneStatus, number> = {
    achieved: 3,
    approaching: 2,
    projected: 1,
  };
  const best = new Map<string, MilestoneResult>();
  for (const result of results) {
    const key = result.kind;
    const existing = best.get(key);
    if (!existing || rank[result.status] > rank[existing.status]) {
      best.set(key, result);
    }
  }
  return [...best.values()];
}

/** Active gameplay-facing milestones (approaching / projected / recent achieved). */
export function activeGameplayMilestones(
  seasons: readonly FranchiseSeasonRecord[],
  live: LiveMilestoneContext,
): MilestoneResult[] {
  return queryHistoricalMilestones(seasons, live).filter(
    (m) =>
      m.status === "approaching" ||
      m.status === "projected" ||
      (m.status === "achieved" && m.seasonYear === live.seasonYear),
  );
}
