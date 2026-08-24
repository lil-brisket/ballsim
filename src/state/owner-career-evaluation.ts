import type { OwnerObjectiveCategory } from "@/domain/entities/owner-objective";
import type { OwnerPhilosophy } from "@/domain/entities/owner-philosophy";
import type { GameState } from "@/state/game-state";
import { calculateFranchiseValue } from "@/state/franchise-value";
import {
  countCareerChampionships,
  countCareerPlayoffAppearances,
} from "@/systems/owner-objective-definitions";
import { getOwnerPhilosophyProfile } from "@/systems/owner-philosophy-config";
import { confidenceAlignmentScore } from "@/systems/ownership-confidence-engine";

export type OwnerCareerBand =
  | "struggling"
  | "mixed"
  | "successful"
  | "legacy";

export type OwnerCareerEvaluation = {
  band: OwnerCareerBand;
  /** Blended objective + ownership-confidence alignment (0–100). */
  alignmentScore: number;
  /** Objective-category alignment only. */
  objectiveAlignmentScore: number;
  /** Ownership confidence alignment contribution. */
  strategicAlignmentScore: number;
  championships: number;
  playoffAppearances: number;
  completedObjectives: number;
  failedObjectives: number;
  franchiseValue: number;
  franchiseValueGrowth: number | null;
  ownerPatience: number;
  philosophy: OwnerPhilosophy;
  headline: string;
};

/**
 * Derived ownership career evaluation — not a second reputation system.
 * Reads franchise history + objective records + mandate patience +
 * modest ownership-confidence alignment (no philosophy-specific band overrides).
 */
export function toOwnerCareerEvaluation(
  state: GameState,
): OwnerCareerEvaluation {
  const teamId = state.user.controlledTeamId;
  const philosophy = state.user.ownerPhilosophy;
  const profile = getOwnerPhilosophyProfile(philosophy);
  const objectives = state.user.objectives;
  const completed = objectives.filter(
    (objective) => objective.status === "completed",
  );
  const failed = objectives.filter(
    (objective) => objective.status === "failed",
  );

  const topCategories = topWeightedCategories(profile.categoryWeights);
  const alignedCompleted = completed.filter((objective) =>
    topCategories.includes(objective.category),
  ).length;
  const objectiveAlignmentScore =
    completed.length === 0
      ? 50
      : Math.round((alignedCompleted / completed.length) * 100);

  const strategicAlignmentScore = confidenceAlignmentScore(state);
  const alignmentScore = Math.round(
    objectiveAlignmentScore * 0.6 + strategicAlignmentScore * 0.4,
  );

  const championships = countCareerChampionships(state, teamId);
  const playoffAppearances = countCareerPlayoffAppearances(state, teamId);
  const franchiseValue = calculateFranchiseValue(state, teamId);
  const history = state.business.franchiseHistory[teamId];
  const firstValue = history?.seasons[0]?.franchiseValue;
  const franchiseValueGrowth =
    firstValue !== undefined && firstValue > 0
      ? Math.round(((franchiseValue - firstValue) / firstValue) * 100)
      : null;

  const band = resolveBand({
    championships,
    playoffAppearances,
    completed: completed.length,
    failed: failed.length,
    alignmentScore,
    patience: state.user.ownerPatience,
  });

  return {
    band,
    alignmentScore,
    objectiveAlignmentScore,
    strategicAlignmentScore,
    championships,
    playoffAppearances,
    completedObjectives: completed.length,
    failedObjectives: failed.length,
    franchiseValue,
    franchiseValueGrowth,
    ownerPatience: state.user.ownerPatience,
    philosophy,
    headline: headlineForBand(band, philosophy),
  };
}

function topWeightedCategories(
  weights: Record<OwnerObjectiveCategory, number>,
): OwnerObjectiveCategory[] {
  return (Object.keys(weights) as OwnerObjectiveCategory[])
    .sort((a, b) => weights[b] - weights[a])
    .slice(0, 2);
}

function resolveBand(input: {
  championships: number;
  playoffAppearances: number;
  completed: number;
  failed: number;
  alignmentScore: number;
  patience: number;
}): OwnerCareerBand {
  if (
    input.championships >= 3 ||
    (input.championships >= 1 && input.playoffAppearances >= 5)
  ) {
    return "legacy";
  }
  if (
    input.championships >= 1 ||
    (input.playoffAppearances >= 3 &&
      input.alignmentScore >= 55 &&
      input.patience >= 45)
  ) {
    return "successful";
  }
  if (
    input.failed > input.completed + 2 &&
    input.patience < 35 &&
    input.playoffAppearances === 0
  ) {
    return "struggling";
  }
  return "mixed";
}

function headlineForBand(
  band: OwnerCareerBand,
  philosophy: OwnerPhilosophy,
): string {
  switch (band) {
    case "legacy":
      return "Building an ownership legacy";
    case "successful":
      return `Meeting ${philosophyLabel(philosophy)} ownership expectations`;
    case "struggling":
      return "Ownership patience is wearing thin";
    case "mixed":
      return "A mixed ownership record so far";
  }
}

function philosophyLabel(philosophy: OwnerPhilosophy): string {
  switch (philosophy) {
    case "win_now":
      return "Win Now";
    case "build_for_the_future":
      return "Build for the Future";
    case "financially_conservative":
      return "Financially Conservative";
    case "market_expansion":
      return "Market Expansion";
    case "balanced":
      return "Balanced";
  }
}
