/**
 * Letter grades for ratings, so the roster sheet and player boxes can show
 * "B+" or "81" from the same value. Cut-offs were calibrated on seeded
 * leagues (top-10 players per team): single skills spread across the whole
 * scale, a median rotation skill is about 65 (C+), a star-level skill is A-/A
 * and a specialist's best skill is A+. Pure presentation; never feeds
 * gameplay.
 */

import type { RatingTierId } from "@/presentation/rating-tier";

export type RatingDisplayMode = "grades" | "ratings";

export const GRADES = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
] as const;

export type Grade = (typeof GRADES)[number];

/** Inclusive lower bound of every grade except F, best first. */
export const GRADE_MINIMUMS: readonly (readonly [
  Exclude<Grade, "F">,
  number,
])[] = [
  ["A+", 93],
  ["A", 88],
  ["A-", 84],
  ["B+", 80],
  ["B", 76],
  ["B-", 72],
  ["C+", 68],
  ["C", 64],
  ["C-", 60],
  ["D+", 55],
  ["D", 50],
  ["D-", 45],
];

export function gradeFor(rating: number): Grade {
  for (const [grade, minimum] of GRADE_MINIMUMS) {
    if (rating >= minimum) return grade;
  }
  return "F";
}

/**
 * The tier colour a letter uses (see rating-tier.ts), chosen by letter so the
 * same letter always has the same colour. A+ is elite, the rest of the A and
 * B+ range is star, B and B- starter, C range role player, below that bench.
 */
const GRADE_BANDS: Record<Grade, RatingTierId> = {
  "A+": "elite",
  A: "star",
  "A-": "star",
  "B+": "star",
  B: "starter",
  "B-": "starter",
  "C+": "role",
  C: "role",
  "C-": "role",
  "D+": "bench",
  D: "bench",
  "D-": "bench",
  F: "bench",
};

export function gradeBand(grade: Grade): RatingTierId {
  return GRADE_BANDS[grade];
}

function spokenGrade(grade: Grade): string {
  return grade.replace("+", " plus").replace("-", " minus");
}

export type FormattedRating = {
  /** What the cell shows. */
  text: string;
  /** Screen-reader and tooltip text; always carries the number. */
  label: string;
  grade: Grade;
  /** Tier id for the colour (same band in both modes). */
  band: RatingTierId;
};

export function formatRating(
  rating: number,
  mode: RatingDisplayMode,
): FormattedRating {
  const value = Math.round(rating);
  const grade = gradeFor(value);
  return {
    text: mode === "grades" ? grade : String(value),
    label:
      mode === "grades" ? `${spokenGrade(grade)}, ${value}` : String(value),
    grade,
    band: gradeBand(grade),
  };
}
