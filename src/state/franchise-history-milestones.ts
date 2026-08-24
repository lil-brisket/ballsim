import type { FranchiseSeasonRecord } from "@/domain/entities/franchise-history";
import {
  isPlayoffAppearance,
  playoffResultDepth,
} from "@/domain/entities/franchise-history";

/** Numeric milestone with the season that produced it. */
export type SeasonMetric = {
  value: number;
  seasonYear: number;
};

/**
 * Strongest regular-season record by winning percentage, then wins, then
 * earliest season — not “most wins.”
 */
export type BestRecordMetric = {
  wins: number;
  losses: number;
  winPct: number;
  seasonYear: number;
};

export type SeasonRef = {
  seasonYear: number;
};

export type HistoricalHighlight =
  | "championship"
  | "best_record"
  | "highest_franchise_value"
  | "highest_attendance"
  | "first_playoff"
  | "first_championship";

export type FranchiseHistoryMilestones = {
  totalSeasons: number;
  championships: number;
  playoffAppearances: number;
  winningSeasons: number;
  losingSeasons: number;
  bestRecord: BestRecordMetric | null;
  bestWinningPercentage: BestRecordMetric | null;
  highestFranchiseValue: SeasonMetric | null;
  highestAttendance: SeasonMetric | null;
  firstPlayoffSeason: SeasonRef | null;
  firstChampionshipSeason: SeasonRef | null;
  lastPlayoffSeason: SeasonRef | null;
  lastChampionshipSeason: SeasonRef | null;
  /**
   * Years under current ownership including the current season.
   * ownerStart 2026 + current 2026 → 1; 2027 → 2. Pre-ownership history
   * seasons do not affect this formula.
   */
  currentOwnershipTenureYears: number;
  longestPlayoffStreak: number;
  /** Completed seasons since most recent title; null if never champion. */
  championshipDrought: number | null;
  /**
   * Most successful completed season: championship → deeper playoff result →
   * regular-season win% → higher franchise value → earliest season.
   */
  mostSuccessfulSeason: SeasonRef | null;
};

function winPct(wins: number, losses: number): number {
  const games = wins + losses;
  return games === 0 ? 0 : wins / games;
}

function isWinningSeason(season: FranchiseSeasonRecord): boolean {
  return season.wins > season.losses;
}

function isLosingSeason(season: FranchiseSeasonRecord): boolean {
  return season.wins < season.losses;
}

/**
 * Compare records for best win% / best record.
 * Higher win% → more wins → earlier season.
 */
function compareBestRecord(
  a: FranchiseSeasonRecord,
  b: FranchiseSeasonRecord,
): number {
  const pctDiff = winPct(a.wins, a.losses) - winPct(b.wins, b.losses);
  if (pctDiff !== 0) {
    return pctDiff;
  }
  if (a.wins !== b.wins) {
    return a.wins - b.wins;
  }
  return b.seasonYear - a.seasonYear;
}

function toBestRecordMetric(season: FranchiseSeasonRecord): BestRecordMetric {
  return {
    wins: season.wins,
    losses: season.losses,
    winPct: winPct(season.wins, season.losses),
    seasonYear: season.seasonYear,
  };
}

function pickBestRecord(
  seasons: FranchiseSeasonRecord[],
): BestRecordMetric | null {
  if (seasons.length === 0) {
    return null;
  }
  let best = seasons[0]!;
  for (let i = 1; i < seasons.length; i += 1) {
    const candidate = seasons[i]!;
    if (compareBestRecord(candidate, best) > 0) {
      best = candidate;
    }
  }
  return toBestRecordMetric(best);
}

function pickHighestValue(
  seasons: FranchiseSeasonRecord[],
): SeasonMetric | null {
  if (seasons.length === 0) {
    return null;
  }
  let best = seasons[0]!;
  for (let i = 1; i < seasons.length; i += 1) {
    const candidate = seasons[i]!;
    if (candidate.franchiseValue > best.franchiseValue) {
      best = candidate;
    } else if (
      candidate.franchiseValue === best.franchiseValue &&
      candidate.seasonYear < best.seasonYear
    ) {
      best = candidate;
    }
  }
  return { value: best.franchiseValue, seasonYear: best.seasonYear };
}

function pickHighestAttendance(
  seasons: FranchiseSeasonRecord[],
): SeasonMetric | null {
  let best: FranchiseSeasonRecord | null = null;
  for (const season of seasons) {
    if (season.attendance === null) {
      continue;
    }
    if (
      best === null ||
      season.attendance > best.attendance! ||
      (season.attendance === best.attendance &&
        season.seasonYear < best.seasonYear)
    ) {
      best = season;
    }
  }
  if (best === null || best.attendance === null) {
    return null;
  }
  return { value: best.attendance, seasonYear: best.seasonYear };
}

function firstMatching(
  seasons: FranchiseSeasonRecord[],
  predicate: (season: FranchiseSeasonRecord) => boolean,
): SeasonRef | null {
  for (const season of seasons) {
    if (predicate(season)) {
      return { seasonYear: season.seasonYear };
    }
  }
  return null;
}

function lastMatching(
  seasons: FranchiseSeasonRecord[],
  predicate: (season: FranchiseSeasonRecord) => boolean,
): SeasonRef | null {
  for (let i = seasons.length - 1; i >= 0; i -= 1) {
    const season = seasons[i]!;
    if (predicate(season)) {
      return { seasonYear: season.seasonYear };
    }
  }
  return null;
}

function longestPlayoffStreak(seasons: FranchiseSeasonRecord[]): number {
  let longest = 0;
  let current = 0;
  for (const season of seasons) {
    if (isPlayoffAppearance(season.playoffResult)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

/**
 * Completed seasons after the most recent championship.
 * Never champion → null (not franchise age).
 */
function championshipDrought(
  seasons: FranchiseSeasonRecord[],
): number | null {
  let lastChampIndex = -1;
  for (let i = 0; i < seasons.length; i += 1) {
    if (seasons[i]!.championship) {
      lastChampIndex = i;
    }
  }
  if (lastChampIndex < 0) {
    return null;
  }
  return seasons.length - 1 - lastChampIndex;
}

/**
 * Most successful: championship → playoff depth → win% → franchise value → earliest.
 */
function compareMostSuccessful(
  a: FranchiseSeasonRecord,
  b: FranchiseSeasonRecord,
): number {
  if (a.championship !== b.championship) {
    return a.championship ? 1 : -1;
  }
  const depthDiff =
    playoffResultDepth(a.playoffResult) - playoffResultDepth(b.playoffResult);
  if (depthDiff !== 0) {
    return depthDiff;
  }
  const pctDiff = winPct(a.wins, a.losses) - winPct(b.wins, b.losses);
  if (pctDiff !== 0) {
    return pctDiff;
  }
  if (a.franchiseValue !== b.franchiseValue) {
    return a.franchiseValue - b.franchiseValue;
  }
  return b.seasonYear - a.seasonYear;
}

function pickMostSuccessful(
  seasons: FranchiseSeasonRecord[],
): SeasonRef | null {
  if (seasons.length === 0) {
    return null;
  }
  let best = seasons[0]!;
  for (let i = 1; i < seasons.length; i += 1) {
    const candidate = seasons[i]!;
    if (compareMostSuccessful(candidate, best) > 0) {
      best = candidate;
    }
  }
  return { seasonYear: best.seasonYear };
}

/**
 * Current ownership tenure in years. The current season counts as year 1
 * when ownerStartSeasonYear === currentSeasonYear.
 */
export function currentOwnershipTenureYears(
  ownerStartSeasonYear: number,
  currentSeasonYear: number,
): number {
  return Math.max(0, currentSeasonYear - ownerStartSeasonYear + 1);
}

/**
 * Pure milestones from completed historical season records only.
 * Does not include the in-progress season.
 */
export function computeFranchiseHistoryMilestones(
  seasons: FranchiseSeasonRecord[],
  ownerStartSeasonYear: number,
  currentSeasonYear: number,
): FranchiseHistoryMilestones {
  const chronological = [...seasons].sort(
    (a, b) => a.seasonYear - b.seasonYear,
  );

  let championships = 0;
  let playoffAppearances = 0;
  let winningSeasons = 0;
  let losingSeasons = 0;
  for (const season of chronological) {
    if (season.championship) {
      championships += 1;
    }
    if (isPlayoffAppearance(season.playoffResult)) {
      playoffAppearances += 1;
    }
    if (isWinningSeason(season)) {
      winningSeasons += 1;
    } else if (isLosingSeason(season)) {
      losingSeasons += 1;
    }
  }

  const bestRecord = pickBestRecord(chronological);

  return {
    totalSeasons: chronological.length,
    championships,
    playoffAppearances,
    winningSeasons,
    losingSeasons,
    bestRecord,
    bestWinningPercentage: bestRecord,
    highestFranchiseValue: pickHighestValue(chronological),
    highestAttendance: pickHighestAttendance(chronological),
    firstPlayoffSeason: firstMatching(chronological, (s) =>
      isPlayoffAppearance(s.playoffResult),
    ),
    firstChampionshipSeason: firstMatching(
      chronological,
      (s) => s.championship,
    ),
    lastPlayoffSeason: lastMatching(chronological, (s) =>
      isPlayoffAppearance(s.playoffResult),
    ),
    lastChampionshipSeason: lastMatching(
      chronological,
      (s) => s.championship,
    ),
    currentOwnershipTenureYears: currentOwnershipTenureYears(
      ownerStartSeasonYear,
      currentSeasonYear,
    ),
    longestPlayoffStreak: longestPlayoffStreak(chronological),
    championshipDrought: championshipDrought(chronological),
    mostSuccessfulSeason: pickMostSuccessful(chronological),
  };
}

/**
 * Historical highlight tags per seasonYear (unique under current architecture).
 * A season may receive multiple highlights.
 */
export function getSeasonHistoricalHighlights(
  seasons: FranchiseSeasonRecord[],
): Map<number, HistoricalHighlight[]> {
  const chronological = [...seasons].sort(
    (a, b) => a.seasonYear - b.seasonYear,
  );
  const byYear = new Map<number, HistoricalHighlight[]>();

  const push = (seasonYear: number, highlight: HistoricalHighlight): void => {
    const existing = byYear.get(seasonYear) ?? [];
    if (!existing.includes(highlight)) {
      existing.push(highlight);
      byYear.set(seasonYear, existing);
    }
  };

  for (const season of chronological) {
    if (season.championship) {
      push(season.seasonYear, "championship");
    }
  }

  const bestRecord = pickBestRecord(chronological);
  if (bestRecord) {
    push(bestRecord.seasonYear, "best_record");
  }

  const highestValue = pickHighestValue(chronological);
  if (highestValue) {
    push(highestValue.seasonYear, "highest_franchise_value");
  }

  const highestAttendance = pickHighestAttendance(chronological);
  if (highestAttendance) {
    push(highestAttendance.seasonYear, "highest_attendance");
  }

  const firstPlayoff = firstMatching(chronological, (s) =>
    isPlayoffAppearance(s.playoffResult),
  );
  if (firstPlayoff) {
    push(firstPlayoff.seasonYear, "first_playoff");
  }

  const firstChampionship = firstMatching(
    chronological,
    (s) => s.championship,
  );
  if (firstChampionship) {
    push(firstChampionship.seasonYear, "first_championship");
  }

  return byYear;
}
