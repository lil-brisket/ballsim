/**
 * Franchise Ownership tab (Issue #190): how ownership feels now, how that
 * mood moved season to season, and which owner objectives were met or missed.
 * Read-only; board decisions are resolved from the Front Office.
 */

import { ownershipMoodLabel } from "@/domain/entities/ownership-confidence";
import type { GameState } from "@/state/game-state";
import { getActiveOwnedFranchise } from "@/state/owner-context";
import {
  toOwnershipConfidenceView,
  type OwnershipConfidenceView,
} from "@/state/ownership-confidence-view";
import {
  toObjectivesView,
  type ObjectiveView,
} from "@/state/selectors/dashboard";

export type OwnershipSeasonMoodRow = {
  seasonYear: number;
  moodLabel: string;
  mandateSummary: string;
};

export type OwnershipObjectiveSeason = {
  seasonYear: number;
  completed: number;
  failed: number;
  objectives: ObjectiveView[];
};

export type FranchiseOwnershipView = {
  confidence: OwnershipConfidenceView;
  /** Newest first. */
  seasonMoods: OwnershipSeasonMoodRow[];
  /** Resolved (completed or failed) objectives by season, newest first. */
  objectiveSeasons: OwnershipObjectiveSeason[];
  totals: { completed: number; failed: number };
};

export function toFranchiseOwnershipView(
  state: GameState,
): FranchiseOwnershipView {
  const franchise = getActiveOwnedFranchise(state);

  const seasonMoods = [...franchise.ownershipConfidence.seasonNotes]
    .sort((a, b) => b.seasonYear - a.seasonYear)
    .map((note) => ({
      seasonYear: note.seasonYear,
      moodLabel: ownershipMoodLabel(note.mood),
      mandateSummary: note.mandateSummary,
    }));

  const bySeason = new Map<number, OwnershipObjectiveSeason>();
  for (const objective of toObjectivesView(state)) {
    if (objective.status !== "completed" && objective.status !== "failed") {
      continue;
    }
    const season = bySeason.get(objective.seasonYear) ?? {
      seasonYear: objective.seasonYear,
      completed: 0,
      failed: 0,
      objectives: [],
    };
    if (objective.status === "completed") {
      season.completed += 1;
    } else {
      season.failed += 1;
    }
    season.objectives.push(objective);
    bySeason.set(objective.seasonYear, season);
  }
  const objectiveSeasons = [...bySeason.values()].sort(
    (a, b) => b.seasonYear - a.seasonYear,
  );

  return {
    confidence: toOwnershipConfidenceView(state),
    seasonMoods,
    objectiveSeasons,
    totals: {
      completed: objectiveSeasons.reduce((sum, s) => sum + s.completed, 0),
      failed: objectiveSeasons.reduce((sum, s) => sum + s.failed, 0),
    },
  };
}
