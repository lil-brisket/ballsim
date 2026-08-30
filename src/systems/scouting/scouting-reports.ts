/**
 * Build scouting report presentation from EstimatedProspectData.
 * Strengths/weaknesses derived ONLY from estimatedCategories — never true attrs.
 */

import type {
  EstimatedProspectData,
  EstimatedScoutingCategoryKey,
  ScoutConfidence,
  ScoutingKnowledgeLevel,
  ScoutingStrengthWeakness,
} from "@/domain/entities/scouting-types";
import { ratingRangeMidpoint } from "@/domain/entities/scouting-types";

const CATEGORY_LABELS: Record<
  EstimatedScoutingCategoryKey,
  { strength: string; weakness: string }
> = {
  shooting: {
    strength: "Strong perimeter shooting",
    weakness: "Limited shooting range",
  },
  finishing: {
    strength: "Elite finisher",
    weakness: "Poor finishing",
  },
  passing: {
    strength: "Playmaker",
    weakness: "Limited playmaking",
  },
  ballHandling: {
    strength: "Elite ball handler",
    weakness: "Limited ball handling",
  },
  perimeterDefense: {
    strength: "High-level perimeter defender",
    weakness: "Poor perimeter defense",
  },
  interiorDefense: {
    strength: "Interior presence",
    weakness: "Weak interior defense",
  },
  rebounding: {
    strength: "Strong rebounder",
    weakness: "Weak rebounding",
  },
  athleticism: {
    strength: "Explosive athlete",
    weakness: "Limited athleticism",
  },
};

export type ScoutingReportPresentation = {
  estimate: EstimatedProspectData;
  strengths: ScoutingStrengthWeakness[];
  weaknesses: ScoutingStrengthWeakness[];
};

/**
 * Derive strengths/weaknesses from estimated category midpoints.
 * Confidence mirrors overall estimate confidence, reduced one step at low knowledge.
 */
export function deriveStrengthsWeaknessesFromEstimates(
  estimate: EstimatedProspectData,
  maxEach = 3,
): {
  strengths: ScoutingStrengthWeakness[];
  weaknesses: ScoutingStrengthWeakness[];
} {
  if (
    estimate.knowledgeLevel === "unknown" ||
    estimate.knowledgeLevel === "basic"
  ) {
    return { strengths: [], weaknesses: [] };
  }

  const conf = presentationConfidence(
    estimate.confidence,
    estimate.knowledgeLevel,
  );
  const entries = (
    Object.keys(estimate.estimatedCategories) as EstimatedScoutingCategoryKey[]
  ).map((category) => ({
    category,
    mid: ratingRangeMidpoint(estimate.estimatedCategories[category]),
  }));

  const strengths: ScoutingStrengthWeakness[] = entries
    .filter((e) => e.mid >= 78)
    .sort((a, b) => b.mid - a.mid)
    .slice(0, maxEach)
    .map((e) => ({
      label: CATEGORY_LABELS[e.category].strength,
      category: e.category,
      confidence: conf,
      polarity: "strength" as const,
    }));

  const weaknesses: ScoutingStrengthWeakness[] = entries
    .filter((e) => e.mid <= 48)
    .sort((a, b) => a.mid - b.mid)
    .slice(0, maxEach)
    .map((e) => ({
      label: CATEGORY_LABELS[e.category].weakness,
      category: e.category,
      confidence: conf,
      polarity: "weakness" as const,
    }));

  return { strengths, weaknesses };
}

function presentationConfidence(
  base: ScoutConfidence,
  level: ScoutingKnowledgeLevel,
): ScoutConfidence {
  if (level === "developing") {
    if (base === "high") return "medium";
    if (base === "medium") return "low";
    return "low";
  }
  return base;
}

export function buildScoutingReport(
  estimate: EstimatedProspectData,
): ScoutingReportPresentation {
  const { strengths, weaknesses } =
    deriveStrengthsWeaknessesFromEstimates(estimate);
  return { estimate, strengths, weaknesses };
}

/**
 * Knowledge-gated view of which fields the UI may show.
 * Does not change the underlying estimate.
 */
export type ScoutingReportView = {
  knowledgeLevel: ScoutingKnowledgeLevel;
  confidence: ScoutConfidence | null;
  scoutGrade: string | null;
  estimatedOverall: { min: number; max: number } | null;
  estimatedPotential: { min: number; max: number } | null;
  projectedRank: { min: number; max: number } | null;
  positionEstimate: string | null;
  positionConfidence: ScoutConfidence | null;
  categories: Partial<
    Record<EstimatedScoutingCategoryKey, { min: number; max: number }>
  >;
  strengths: ScoutingStrengthWeakness[];
  weaknesses: ScoutingStrengthWeakness[];
  intangibles: EstimatedProspectData["intangibles"];
  movement: EstimatedProspectData["movement"] | null;
};

export function toScoutingReportView(
  estimate: EstimatedProspectData | null | undefined,
): ScoutingReportView {
  if (!estimate || estimate.knowledgeLevel === "unknown") {
    return {
      knowledgeLevel: "unknown",
      confidence: null,
      scoutGrade: null,
      estimatedOverall: null,
      estimatedPotential: null,
      projectedRank: null,
      positionEstimate: estimate?.positionEstimate ?? null,
      positionConfidence: estimate?.positionConfidence ?? null,
      categories: {},
      strengths: [],
      weaknesses: [],
      intangibles: {},
      movement: null,
    };
  }

  const report = buildScoutingReport(estimate);
  const level = estimate.knowledgeLevel;
  const showCategories =
    level === "detailed" || level === "comprehensive";
  const showIntangibles =
    level === "detailed" || level === "comprehensive";
  const showStrengths =
    level === "developing" ||
    level === "detailed" ||
    level === "comprehensive";

  const categories: ScoutingReportView["categories"] = {};
  if (showCategories) {
    for (const key of Object.keys(
      estimate.estimatedCategories,
    ) as EstimatedScoutingCategoryKey[]) {
      categories[key] = { ...estimate.estimatedCategories[key] };
    }
  }

  return {
    knowledgeLevel: level,
    confidence: estimate.confidence,
    scoutGrade: estimate.scoutGrade,
    estimatedOverall: { ...estimate.estimatedOverall },
    estimatedPotential: { ...estimate.estimatedPotential },
    projectedRank: { ...estimate.projectedRank },
    positionEstimate: estimate.positionEstimate,
    positionConfidence: estimate.positionConfidence,
    categories,
    strengths: showStrengths ? report.strengths : [],
    weaknesses: showStrengths ? report.weaknesses : [],
    intangibles: showIntangibles ? { ...estimate.intangibles } : {},
    movement: estimate.movement ?? null,
  };
}
