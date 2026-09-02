/**
 * Flexible offseason phase windows: min/max duration + completion conditions.
 * Anchored relative to offseasonStart (day after playoffs/season review ends).
 * Not rigid fixed spans — completion and blocking state can extend a window.
 */

import type { LeaguePhaseId } from "@/systems/phase-engine/phase-types";

export type PhaseCompletionCondition =
  | "automatic"
  | "required_tasks_complete"
  | "preparation_complete"
  | "draft_complete"
  | "free_agency_period_complete"
  | "until_preseason_start"
  | "until_regular_season_start";

export type PhaseWindowConfig = {
  phaseId: LeaguePhaseId;
  /** Earliest start offset (days) from offseasonStart. */
  startOffsetDays: number;
  minimumDurationDays: number;
  /** Null = until next phase / season anchor. */
  maximumDurationDays: number | null;
  completionCondition: PhaseCompletionCondition;
};

/** Days before regularSeasonStart for preseason window. */
export const PRESEASON_LENGTH_DAYS = 21;

/** Short postseason season-review hold before offseasonStart. */
export const SEASON_REVIEW_LENGTH_DAYS = 3;

/**
 * Ordered offseason → preseason window templates.
 * Free agency / staff / preseason start offsets are resolved dynamically
 * when earlier phases complete (see league-calendar).
 */
export const OFFSEASON_PHASE_WINDOWS: readonly PhaseWindowConfig[] = [
  {
    phaseId: "offseason.season_transition",
    startOffsetDays: 0,
    minimumDurationDays: 1,
    maximumDurationDays: 1,
    completionCondition: "automatic",
  },
  {
    phaseId: "offseason.roster_decisions",
    startOffsetDays: 0,
    minimumDurationDays: 7,
    maximumDurationDays: 21,
    completionCondition: "required_tasks_complete",
  },
  {
    phaseId: "offseason.draft_preparation",
    startOffsetDays: 7,
    minimumDurationDays: 7,
    maximumDurationDays: 21,
    completionCondition: "preparation_complete",
  },
  {
    phaseId: "offseason.draft",
    startOffsetDays: 14,
    minimumDurationDays: 3,
    maximumDurationDays: null,
    completionCondition: "draft_complete",
  },
  {
    phaseId: "offseason.free_agency",
    startOffsetDays: 17,
    minimumDurationDays: 30,
    maximumDurationDays: 45,
    completionCondition: "free_agency_period_complete",
  },
  {
    phaseId: "offseason.staff_development",
    startOffsetDays: 47,
    minimumDurationDays: 7,
    maximumDurationDays: null,
    completionCondition: "until_preseason_start",
  },
  {
    phaseId: "preseason.preparation",
    startOffsetDays: 0, // resolved from preseasonStart anchor
    minimumDurationDays: 14,
    maximumDurationDays: null,
    completionCondition: "until_regular_season_start",
  },
] as const;

export function getPhaseWindowConfig(
  phaseId: LeaguePhaseId,
): PhaseWindowConfig | null {
  return OFFSEASON_PHASE_WINDOWS.find((w) => w.phaseId === phaseId) ?? null;
}
